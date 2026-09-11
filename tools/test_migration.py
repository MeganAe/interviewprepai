import base64
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import uuid
import psycopg
from psycopg import sql
from migrate_sqlite import migrate


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.admin = psycopg.connect(autocommit=True)
        self.name = 'prep_migration_' + uuid.uuid4().hex
        self.admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(self.name)))
        self.env = patch.dict(os.environ, {'PGDATABASE': self.name})
        self.env.start()
        with psycopg.connect(autocommit=True) as c:
            c.execute((Path(__file__).resolve().parents[1] / 'database/schema.sql').read_text())
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'legacy-test.db'
        self.uid, self.rid = str(uuid.uuid4()), str(uuid.uuid4())
        self.salt = base64.b64encode(bytes(range(16))).decode()
        self.hash = base64.b64encode(hashlib.pbkdf2_hmac('sha256', b'test-password-123', bytes(range(16)), 600000, 32)).decode()
        self.data = json.dumps({'id':self.rid,'name':'fixture.pdf','createdAt':'2026-09-08T12:00:00Z','analysis':{'role':'Test'}}, ensure_ascii=False)
        with sqlite3.connect(self.path) as c:
            c.executescript('CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,salt TEXT,hash TEXT); CREATE TABLE records(id TEXT PRIMARY KEY,userId TEXT,kind TEXT,data TEXT);')
            c.execute('INSERT INTO users VALUES(?,?,?,?,?)', (self.uid,'Compte test','test@example.test',self.salt,self.hash))
            c.execute('INSERT INTO records VALUES(?,?,?,?)', (self.rid,self.uid,'cv',self.data))
        self.source_hash = hashlib.sha256(self.path.read_bytes()).hexdigest()

    def count(self, table='users'):
        with psycopg.connect() as c:
            return c.execute(sql.SQL('SELECT count(*) FROM {}').format(sql.Identifier(table))).fetchone()[0]

    def tearDown(self):
        self.env.stop()
        self.admin.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(self.name)))
        self.admin.close()
        self.temp.cleanup()

    def test_default_is_real_dry_run_with_rollback(self):
        self.assertEqual(migrate(self.path), (1,1))
        self.assertEqual(self.count(),0)
        self.assertEqual(hashlib.sha256(self.path.read_bytes()).hexdigest(),self.source_hash)

    def test_commit_preserves_ids_password_hash_and_json_without_granting_access(self):
        self.assertEqual(migrate(self.path,True),(1,1))
        with psycopg.connect() as c:
            row=c.execute('SELECT id,salt,hash,is_paid,paid_at FROM users').fetchone()
            self.assertEqual(row,(self.uid,self.salt,self.hash,False,None))
            self.assertEqual(c.execute('SELECT data FROM records').fetchone()[0],self.data)
        self.assertEqual(hashlib.sha256(self.path.read_bytes()).hexdigest(),self.source_hash)

    def test_nonempty_destination_is_never_overwritten(self):
        migrate(self.path,True)
        with self.assertRaises(ValueError):
            migrate(self.path,True)
        self.assertEqual(self.count(),1)
        self.assertEqual(self.count('records'),1)

    def test_corrupt_source_is_rejected(self):
        with sqlite3.connect(self.path) as c:
            c.execute("UPDATE records SET data='{}'")
        with self.assertRaises(ValueError):
            migrate(self.path,True)
        self.assertEqual(self.count(),0)

    def test_postgres_json_failure_rolls_back_already_inserted_users(self):
        data=json.loads(self.data)
        data['invalid']=float('nan')
        with sqlite3.connect(self.path) as c:
            c.execute('UPDATE records SET data=?',(json.dumps(data),))
        with self.assertRaises(psycopg.errors.InvalidTextRepresentation):
            migrate(self.path,True)
        self.assertEqual(self.count(),0)
        self.assertEqual(self.count('records'),0)


if __name__ == '__main__':
    unittest.main()
