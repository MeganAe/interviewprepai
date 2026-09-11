# Interview Prep AI — v3

Application française de préparation aux entretiens. Frontend TypeScript/Material Web, thème Amber clair, Roboto Serif et logo personnalisé. Backend ASP.NET Core 8, PostgreSQL Supabase via Npgsql, paiement Chariow et préparation Render Docker.

## Commencer

**Lisez [LIRE-MOI.md](LIRE-MOI.md)** : SQL intégral, configuration des secrets, produit et Pulse Chariow, déploiement GitHub → Render, migration SQLite, tests et limites du gratuit.

1. Créer un projet Supabase dédié et exécuter `database/schema.sql`.
2. Configurer les variables d’environnement indiquées dans le guide. Les secrets dans `server/appsettings.json` restent vides.
3. Déployer ce dépôt sur Render avec le `Dockerfile` à la racine, ou avec le Blueprint `render.yaml`.
4. Configurer le Pulse Chariow vers `https://ton-app.onrender.com/api/pulse`.

Le frontend s’ouvre sur la page publique. Les comptes non payés peuvent consulter `#pricing`. Le tarif est lu chez Chariow, jamais inventé. Seule une vente terminée avec signature valide et métadonnées du bon compte active l’accès. Le retour `#merci` attend la confirmation enregistrée en base.

## Développement

.NET SDK 8, Node 22 et PostgreSQL sont requis. Voir le guide pour les variables locales et la création du schéma.

```bash
npm ci --prefix client
npm run build --prefix client
dotnet run --project server --no-launch-profile
```

`build.sh` teste et publie en **linux-x64** ; les tests .NET exigent `TEST_POSTGRES_CONNECTION` vers un PostgreSQL **de test** disposant du droit `CREATEDB`.

La v3 n’utilise plus `DataPath`, `App_Data` ou SQLite au démarrage. L’outil facultatif `tools/migrate_sqlite.py` copie une ancienne base hors ligne, en simulation par défaut. Le résultat Linux v3 n’est pas l’ancienne publication Windows v2.

## Vérifications et limites

**115 tests réussis : 55 DOM, 55 API/.NET sur PostgreSQL, 5 migration.** Compilation de production et contrôles HTTP documentés dans `BUILD-V3.txt`.

Aucune vérification navigateur, aucun paiement réel, aucun appel Gemini réel, aucun déploiement Supabase/Render. L’image Docker n’a pas été construite ici, faute de moteur Docker ; le frontend et la publication .NET Linux ont été compilés. Les identifiants prestataires et les informations commerciales restent à renseigner.

Les licences tierces sont dans `licenses/`.
