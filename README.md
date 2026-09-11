# Interview Prep AI — v5

**V5 :** logo uniquement typographique, Support/Contact, conversations privées et administration avec accès gratuit pour un seul compte configuré côté serveur. **Commencez par [la mise à jour v5](docs/MISE-A-JOUR-V5.md)** : petit ajout SQL et `Admin__UserId` à renseigner. Les secrets existants et le correctif TLS sont conservés.

Application française de préparation aux entretiens. Frontend TypeScript/Material Web, thème Amber clair, Roboto Serif et logo personnalisé. Backend ASP.NET Core 8, PostgreSQL Supabase via Npgsql, paiement Chariow et préparation Render Docker.

## Commencer

**Lisez [LIRE-MOI.md](LIRE-MOI.md)** : SQL intégral, configuration des secrets, produit et Pulse Chariow, déploiement GitHub → Render, migration SQLite, tests et limites du gratuit.

1. Créer un projet Supabase dédié et exécuter `database/schema.sql`.
2. Configurer les variables d’environnement indiquées dans le guide. Les secrets dans `server/appsettings.json` restent vides.
3. Déployer ce dépôt sur Render avec le `Dockerfile` à la racine, ou avec le Blueprint `render.yaml`.
4. Configurer le Pulse Chariow vers `https://ton-app.onrender.com/api/pulse`.

Le frontend s’ouvre sur la page publique. Les comptes non payés peuvent consulter `#pricing`. Le tarif est lu chez Chariow, jamais inventé. Pour les comptes ordinaires, seule une vente terminée avec signature valide et métadonnées du bon compte active l’accès. Le compte désigné par `Admin__UserId` dispose d’un accès admin gratuit distinct ; il n’est pas marqué payé artificiellement. Le retour `#merci` attend la confirmation enregistrée en base.

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

**213 tests réussis : 93 DOM, 115 API/.NET sur PostgreSQL, 5 migration.** Compilation de production frontend et publication .NET Linux documentées dans `BUILD-V5.txt`.

Aucune vérification navigateur, aucun paiement réel, aucun appel Gemini réel, aucun déploiement Supabase/Render. L’image Docker n’a pas été construite ici, faute de moteur Docker ; le frontend et la publication .NET Linux ont été compilés. Les identifiants prestataires et les informations commerciales restent à renseigner.

Les licences tierces sont dans `licenses/`.

Correctif du 11 septembre : [instructions de mise à jour Chariow et icône Accès](docs/CORRECTIF-CHARIOW.md). Le Dockerfile actuel attend le certificat CA officiel Supabase dans Render Secret Files sous le nom `supabase-ca.crt` ; voir LIRE-MOI pour conserver VerifyFull.
