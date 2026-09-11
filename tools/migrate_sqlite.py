#!/usr/bin/env python3
"""Offline v2 -> v3 migration. Source is read-only; destination must be empty.
Connection: standard libpq PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD/PGSSLMODE.
Dry-run by default, even with a real target. --commit is required to persist.
"""
import argparse
import base64
from contextlib import closing
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import uuid
import psycopg


def migrate(path: Path, commit: bool = False) -> tuple[int, int]:
    path = path.resolve(strict=True)
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as source:
        source.row_factory = sqlite3.Row
        source.execute('PRAGMA query_only=ON')
        source.execute('BEGIN')
        users = source.execute('SELECT id,name,email,salt,hash FROM users ORDER BY id').fetchall()
        records = source.execute('SELECT id,userId,kind,data FROM records ORDER BY id').fetchall()
        ids = set()
        for row in users:
            uuid.UUID(row['id'])
            if any(not isinstance(row[k], str) or not row[k] for k in ('name','email','salt','hash')):
                raise ValueError('Compte source incomplet.')
            if len(base64.b64decode(row['salt'], validate=True)) != 16 or len(base64.b64decode(row['hash'], validate=True)) != 32:
                raise ValueError('Empreinte de mot de passe source incompatible.')
            if row['email'] != row['email'].strip().lower():
                raise ValueError('Une adresse source n’est pas normalisée. Corrigez une copie avant migration.')
            ids.add(row['id'])
        for row in records:
            uuid.UUID(row['id'])
            if row['userId'] not in ids or row['kind'] not in ('cv','session'):
                raise ValueError('Document orphelin ou type de document inconnu.')
            data = json.loads(row['data'])
            if not isinstance(data, dict) or data.get('id') != row['id']:
                raise ValueError('Identifiant JSON incohérent.')
            datetime.fromisoformat(data['createdAt'].replace('Z','+00:00'))
        with psycopg.connect() as target:
            # Do not combine a migration with active application traffic.
            target.execute('LOCK TABLE public.users,public.records,public.payment_receipts,public.checkout_sessions IN ACCESS EXCLUSIVE MODE')
            for table in ('users','records','payment_receipts','checkout_sessions'):
                if target.execute(f'SELECT count(*) FROM public.{table}').fetchone()[0]:
                    raise ValueError('La destination contient déjà des données : fusion et écrasement refusés.')
            for row in users:
                target.execute('INSERT INTO public.users(id,name,email,salt,hash) VALUES(%s,%s,%s,%s,%s)', tuple(row))
            for row in records:
                # Validate using PostgreSQL too (reject NaN, invalid Unicode/JSON).
                target.execute('SELECT %s::jsonb', (row['data'],))
                target.execute('INSERT INTO public.records(id,"userId",kind,data) VALUES(%s,%s,%s,%s)', tuple(row))
            if target.execute('SELECT count(*) FROM public.users').fetchone()[0] != len(users) or target.execute('SELECT count(*) FROM public.records').fetchone()[0] != len(records):
                raise ValueError('Le contrôle des comptes et documents a échoué.')
            if not commit:
                target.rollback()
            # Context manager commits only here if --commit; any exception rolls back.
        return len(users), len(records)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sqlite_file', type=Path, help='Copie de la base SQLite v2, application arrêtée')
    parser.add_argument('--commit', action='store_true', help='Copier réellement. Sans ce drapeau : transaction annulée.')
    args = parser.parse_args()
    try:
        users, records = migrate(args.sqlite_file, args.commit)
    except Exception as error:
        # Never print SQL errors that could disclose emails, hashes or credentials.
        print(f'ÉCHEC ({type(error).__name__}). Transaction annulée ; source non modifiée. Vérifiez le schéma, la connexion, la vacuité de la destination et la validité des données. Aucun secret n’est affiché.')
        return 1
    print(f'{"COPIE VALIDÉE" if args.commit else "SIMULATION ANNULÉE"} : {users} comptes, {records} documents.')
    print('Identifiants, mots de passe et JSON conservés. is_paid=false pour les comptes importés. Notes IndexedDB non transférées. Reconnexion nécessaire.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
