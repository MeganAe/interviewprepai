# Interview Prep AI — v3
## PostgreSQL Supabase · Paiement Chariow · Préparation Render

**Livraison du 8 septembre 2026.** Application française, thème Amber clair, composants Material Web, Roboto Serif et logo propre au produit. Aucun CV, entretien ou paiement de démonstration n’est préchargé.

> Cette livraison prépare le déploiement ; elle ne crée pas de projet Supabase, de boutique Chariow ou de service Render. Les identifiants réels et le prix ne sont pas fournis. Le prix affiché vient du produit Chariow configuré : si ce service est indisponible, aucun montant fictif n’est affiché et le paiement reste désactivé.

### Ce qui a été vérifié

- **55 tests DOM** HappyDOM/Vitest : parcours existant, formulaire, navigation protégée, paiement en attente et confirmation. **Aucune vérification dans un navigateur**, conformément à la demande.
- **55 tests .NET**, avec de vraies bases PostgreSQL locales isolées : authentification, isolation, workflow complet, cookies persistants, paywall, signatures, deux formats Pulse, concurrence, doublons, erreurs et transactions.
- **5 tests de migration SQLite → PostgreSQL** : simulation annulée, copie réelle, données/mots de passe préservés, refus de fusion et rollback après erreur.
- Compilation de production frontend et publication .NET 8 **linux-x64, self-contained=false**. Voir `BUILD-V3.txt` pour la sortie exacte et les contrôles HTTP du résultat publié.
- **Non vérifiés en conditions réelles :** API Chariow/Gemini avec clés réelles, Supabase distant, déploiement Render et rendu visuel navigateur. Le Dockerfile est préparé ; l’image Docker n’a pas été construite dans cet environnement sans moteur Docker.

## 1. Contenu de la livraison

- `Interview-Prep-AI-Sources-v3.zip` : sources à déposer à la racine du dépôt GitHub, `Dockerfile`, `render.yaml`, SQL, tests, outil de migration et ce guide.
- `Interview-Prep-AI-Render-linux-x64-v3.zip` : résultat de `dotnet publish`, frontend compilé dans `wwwroot`, configuration vide, licences et documentation. **Ce n’est pas une image Docker ni la publication Windows v2.** Il nécessite ASP.NET Core Runtime 8 et une connexion PostgreSQL ; Render construit son image à partir de l’archive des sources.
- `database/schema.sql` : script SQL intégral, également reproduit en section 3.
- `tools/migrate_sqlite.py` : migration administrative hors ligne, jamais exécutée automatiquement au démarrage.

L’application n’utilise plus SQLite en fonctionnement normal, ni `DataPath`, ni un dossier local `App_Data`. Npgsql 8.0.8 remplace le fournisseur SQLite. SQLite n’est lu que par l’utilitaire facultatif de migration.

## 2. Créer et connecter Supabase

1. Créez un **projet Supabase dédié**. Conservez son mot de passe PostgreSQL dans un gestionnaire de secrets.
2. Dans **SQL Editor**, exécutez intégralement le script de la section 3 ou `database/schema.sql`. Il crée cinq tables et les protections associées. Il ne supprime pas les tables existantes ; ne le lancez pas à l’aveugle dans le projet d’une autre application ayant déjà `public.users`.
3. Dans **Connect**, copiez les paramètres du **Session pooler**, port **5432**. Ce mode convient à un serveur persistant et à l’accès IPv4 de Render. Utilisez le nom d’hôte exact du tableau de bord ; ne le déduisez pas de la région.
4. Construisez la chaîne **Npgsql clé=valeur**, pas une URL PostgreSQL ni une clé API Supabase :

```text
Host=HOTE_DU_SESSION_POOLER;Port=5432;Database=postgres;Username=postgres.REFERENCE_PROJET;Password="MOT_DE_PASSE_DB";SSL Mode=VerifyFull;Maximum Pool Size=10;Timeout=15;Command Timeout=30
```

Les éléments en majuscules sont des **valeurs à remplacer**, pas des identifiants fournis. Les guillemets de `Password` sont utiles si le mot de passe contient un point-virgule ; utilisez l’échappement Npgsql si le mot de passe contient lui-même des guillemets.

5. Dans Render, placez cette chaîne dans `Supabase__ConnectionString`.

**Important :** le pooler transactionnel 6543 a d’autres contraintes, notamment sur les prepared statements. Cette configuration est préparée pour le **session pooler 5432**. La connexion directe peut nécessiter IPv6. Conservez TLS et la validation de certificat ; `VerifyFull` est recommandé. Le serveur refuse les modes Disable/Allow/Prefer en Production. `Require` chiffre mais ne valide pas pleinement l’identité du serveur : ce n’est pas la recommandation de ce guide.

L’authentification de l’application reste celle d’ASP.NET Core par cookie. **Supabase Auth, l’API Data et les clés anon/service_role ne sont pas utilisés.** Les tables sont privées pour les rôles navigateur `anon` et `authenticated`. La connexion du serveur doit employer un rôle de confiance propriétaire des tables (par exemple `postgres` via le session pooler), pas un rôle navigateur soumis à une RLS sans politique.

## 3. SQL intégral à exécuter

Copiez **tout le bloc**, y compris la transaction. Le démarrage de l’application ne crée pas le schéma.

```sql
-- Interview Prep AI v3 — PostgreSQL / Supabase SQL Editor.
-- Run once with the schema owner (Supabase SQL Editor / postgres).
-- No automatic DDL on application startup. No Supabase Auth/Data API is used.
BEGIN;
CREATE TABLE IF NOT EXISTS public.users (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    salt text NOT NULL,
    hash text NOT NULL,
    is_paid boolean NOT NULL DEFAULT false,
    paid_at timestamp with time zone NULL,
    chariow_sale_id text NULL
);
-- Also supports upgrading an already imported PostgreSQL schema.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS chariow_sale_id text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_chariow_sale_unique
    ON public.users(chariow_sale_id) WHERE chariow_sale_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.records (
    id text PRIMARY KEY,
    "userId" text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    data text NOT NULL
);
CREATE INDEX IF NOT EXISTS records_user ON public.records("userId", kind);
-- Audit/idempotency survives account deletion. No customer name/email/phone or raw webhook.
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    sale_id text PRIMARY KEY,
    user_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
    product_id text NOT NULL,
    delivery_id text NULL,
    payload_sha256 text NOT NULL,
    received_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payment_receipts_user ON public.payment_receipts(user_id);
-- Reuse an active checkout instead of creating simultaneous duplicate purchases.
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
    user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    response text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);
-- ASP.NET cookie encryption keys must survive Render restarts/redeploys.
CREATE TABLE IF NOT EXISTS public.data_protection_keys (
    name text PRIMARY KEY,
    xml text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Prevent exposure of account hashes, payment flags and cookie keys via Supabase APIs.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_protection_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users, public.records, public.payment_receipts,
    public.checkout_sessions, public.data_protection_keys FROM PUBLIC;
-- These Supabase roles do not exist on a vanilla PostgreSQL test server.
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.users, public.records, public.payment_receipts, public.checkout_sessions, public.data_protection_keys FROM %I', r);
        END IF;
    END LOOP;
END $$;
COMMIT;
```

Les colonnes de paiement demandées sont `users.is_paid`, `users.paid_at` et `users.chariow_sale_id`. `records."userId"` conserve les identifiants des comptes existants ; son JSON est stocké comme texte, comme en v2. Les autres tables servent à l’idempotence, à la réutilisation d’un checkout et à la persistance des clés de cookie.

## 4. Variables d’environnement

Les secrets doivent rester **exclusivement côté serveur, dans les variables d’environnement**. Tous les champs sensibles de `server/appsettings.json` sont vides. N’ajoutez aucune clé dans `client/`, `wwwroot`, une variable `VITE_*`, le Dockerfile ou le dépôt Git.

| Variable | Valeur / rôle |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` sur Render |
| `ASPNETCORE_URLS` | `http://0.0.0.0:10000` |
| `Supabase__ConnectionString` | Chaîne Npgsql avec paramètres du session pooler, TLS et mot de passe PostgreSQL |
| `Chariow__ApiKey` | Clé API secrète de la boutique Chariow |
| `Chariow__ProductId` | **Identifiant exact `prd_…`**, pas le slug, du produit qui active l’accès |
| `Chariow__PulseSecret` | Secret de signature du Pulse, généralement `whsec_…` ; distinct de la clé API |
| `Gemini__ApiKey` | Clé serveur du projet Google autorisé à utiliser l’API |
| `Gemini__Model` | `gemini-2.5-flash` par défaut, à adapter si nécessaire à votre projet |
| `App__PublicUrl` | Facultatif sur Render : origine publique HTTPS, sans sous-chemin/query/fragment, par ex. `https://ton-app.onrender.com`. À renseigner avec votre domaine personnalisé le cas échéant. |
| `RENDER_EXTERNAL_URL` | Fourni automatiquement par Render ; utilisé comme origine de retour si `App__PublicUrl` est vide. Ne pas fabriquer cette variable dans les sources. |

L’URL de retour est construite **côté serveur** : origine publique + `/#merci`. Elle n’est jamais acceptée depuis le formulaire client. Hors Render, renseignez `App__PublicUrl` explicitement. Une URL HTTP n’est tolérée qu’en Development ; Chariow peut refuser une adresse locale/inaccessible. Pour un vrai essai fournisseur, utilisez une URL publique HTTPS.

## 5. Configurer Chariow

### Produit et prix

1. Créez/publiez le produit représentant l’accès à cette application. Réglez le **vrai montant et la devise** dans Chariow.
2. Configurez `Chariow__ProductId` avec son identifiant public exact.
3. Cette intégration accepte les produits publiés `license`, `downloadable`, `course` ou `bundle`, à prix fixe/unique ou gratuit. **Pas d’abonnement, de prix libre, de service/coaching, de livraison ni de champs produit personnalisés supplémentaires.** Choisissez un produit compatible, sans ces champs.
4. Les produits de type licence autorisent plus facilement les achats répétés ; certains autres types bloquent un nouvel achat du même produit par la même adresse. Cela ne constitue jamais une preuve de propriété du compte applicatif.
5. Le serveur lit `GET https://api.chariow.com/v1/products/{id}` ; le tarif est mis en cache 60 secondes. Le formulaire n’accepte aucun montant, identifiant produit ou droit d’accès transmis par le client.
6. Publiez les informations vendeur, conditions de vente, assistance et règles de remboursement nécessaires dans votre boutique avant d’encaisser. Aucun régime fiscal ni remboursement automatique n’est implémenté par cette application.

### API et Pulse

1. Placez la clé API dans `Chariow__ApiKey`. Le client HTTP nommé **`chariow`** utilise la base `https://api.chariow.com/v1/` et l’en-tête `Authorization: Bearer …`, uniquement sur le serveur.
2. Dans Chariow, ouvrez **Automation → Pulses**, créez un Pulse pour les ventes réussies et indiquez :

```text
https://ton-app.onrender.com/api/pulse
```

3. Ouvrez le Pulse → **Overview → Signing secret**, révélez/copiez le secret dans `Chariow__PulseSecret`. Lors d’une rotation, coordonnez le changement du Pulse et de Render ; les livraisons échouées devront être rejouées.
4. Le format officiel est **`successful.sale`**. Le format de compatibilité **`sale.completed`** demandé est également accepté, avec les mêmes contrôles de signature, statut, produit, compte et idempotence.
5. Les tests de tableau de bord signés contenant `note` sont acquittés mais **n’activent aucun compte**. Pour valider tout le parcours, il faut une vente réelle/de test fournisseur associée au `custom_metadata.user_id` injecté par le serveur, pas l’exemple générique du tableau de bord.

### Parcours effectif

1. L’utilisateur se connecte ; `#pricing` affiche le vrai prix et demande prénom, nom, e-mail du compte, téléphone national et code pays ISO à deux lettres.
2. `POST /api/checkout` vérifie le compte, son accès et les coordonnées. Il appelle `/v1/checkout` avec `phone: {number, country_code}`, l’URL de retour serveur et **`custom_metadata.user_id = ID du compte authentifié`**.
3. La réponse publique ne contient que les champs utiles : `data.step`, référence/statut de la vente et `data.payment.checkout_url`. Aucun fichier privé, licence, numéro de carte ou secret API n’est renvoyé.
4. Si `step=payment`, l’utilisateur est redirigé vers l’URL HTTPS retournée. Si le compte est déjà payé, la réponse locale est `already_paid` et l’accueil s’ouvre sans appel de paiement. `completed` ouvre également l’accueil, **sans fabriquer de statut payé** : un produit gratuit peut encore attendre son Pulse.
5. Le fournisseur peut répondre `already_purchased`. Cela renvoie **409 `PAYMENT_LINK_MISSING`**, sans activer par e-mail. L’interface demande de vérifier la confirmation ou de contacter l’assistance, sans payer une seconde fois.
6. Après retour, `#merci` vérifie `GET /api/checkout/status` toutes les trois secondes, jusqu’à 20 tentatives par séquence. Un bouton permet de recommencer. Seule une réponse serveur `is_paid=true` affiche « Votre accès est actif ». Fermer/changer de page arrête le polling. Sans session, la connexion conserve la destination `merci`.
7. Un checkout en attente est réutilisé 15 minutes pour le même compte. Un verrou PostgreSQL sérialise les créations concurrentes, y compris entre instances. Si le processus tombe **après** création chez Chariow mais **avant** stockage local, une vente non mémorisée reste possible : la création distante n’est pas une garantie d’« exactement une fois ».

## 6. Signature, propriété et idempotence

Le serveur active le buffering avant le contrôleur. Il lit au maximum 256 Kio et calcule :

```text
HMAC-SHA256(secret Pulse en UTF-8, octets exacts du corps reçu)
X-Chariow-Signature: sha256=<64 caractères hexadécimaux>
```

Comparaison en temps constant. Une signature absente/invalide donne **401**. Ne reformatez pas le JSON avant vérification ; espaces et retours à la ligne changent la signature. Seul le vrai **POST `/api/pulse`** est dispensé de l’en-tête anti-CSRF de l’application ; l’exemption ne remplace pas le HMAC. Les headers de livraison ne sont pas une preuve de signature.

Exemple de **structure**, pas d’événement utilisable tel quel :

```json
{
  "event": "successful.sale",
  "sale": {
    "id": "IDENTIFIANT_REEL_DE_VENTE",
    "status": "completed",
    "custom_metadata": { "user_id": "GUID_REEL_DU_COMPTE" }
  },
  "product": { "id": "IDENTIFIANT_REEL_DU_PRODUIT" }
}
```

Compatibilité : `{"event":"sale.completed","data":{"id":"…","status":"completed","product":{"id":"…"},"custom_metadata":{"user_id":"…"}}}`. Les métadonnées contradictoires sont refusées. **L’e-mail du client Chariow n’est jamais utilisé pour retrouver le propriétaire du droit d’accès.**

La transaction PostgreSQL verrouille le compte, enregistre un reçu unique par `sale_id` et effectue la première activation. La contrainte unique sur `users.chariow_sale_id` complète la protection. Une nouvelle livraison du même achat ne modifie pas `paid_at`. Une deuxième vente pour un compte déjà payé peut être auditée, mais ne remplace ni la première date ni la première référence. L’identifiant de livraison est informatif ; le dédoublonnage obligatoire repose sur la vente.

Une signature correcte ne suffit pas : il faut le statut `completed`, le produit configuré et des métadonnées de compte valides. Événement non concerné/autre produit : 200 ignoré. Charge utile incomplète : 422 ; JSON invalide : 400 ; compte inconnu : 404 ; vente déjà liée à un autre compte : 409. Une erreur en cours d’activation annule aussi l’insertion du reçu, pour permettre un rejeu.

Après suppression d’un compte, la référence de vente reste dans `payment_receipts`, sans lien vers ce compte (`user_id=NULL`), afin d’empêcher sa réutilisation. Aucun payload brut ni nom/e-mail/téléphone du Pulse n’est conservé. Le protocole ne fournissant pas de timestamp signé, la protection contre le rejeu repose sur cette persistance : **ne purgez pas ces reçus sans politique maîtrisée**.

## 7. Paywall et données personnelles

Le middleware est placé après l’authentification. Un compte connecté mais non payé reçoit :

```json
{"code":"PAYMENT_REQUIRED","error":"…"}
```

avec HTTP **402** pour les vraies routes de l’application :

- `/api/cvs` et ses descendants ;
- `/api/sessions` et ses descendants, y compris réponses et évaluation ;
- `/api/data`.

Un visiteur anonyme reçoit 401 sur les ressources privées. Les routes d’authentification, `/api/me`, `/api/checkout`, `/api/checkout/status`, l’offre publique, Pulse et la santé ne sont pas verrouillées par le paiement. Les routes de gestion de compte conservent leur propre authentification.

Le routeur recontrôle le statut pour `#cv`, `#practice`, `#history`, `#session/...`, `#results/...` et les alias d’analyse/entretien. Les actions d’import et de création vérifient aussi l’accès depuis l’accueil. Une panne de vérification ne donne pas accès par défaut. Le menu ordinateur et la navigation mobile proposent « Accès » aux comptes non payés.

L’export **`GET /api/account/export`** reste disponible pour les propres données du compte, même non payé. La suppression du compte (`DELETE /api/me`) et de ses documents (`DELETE /api/records/{id}`) ne sont pas conditionnées à un achat. Les notes/brouillons/favoris IndexedDB restent locaux et isolés par compte.

## 8. Déployer sur Render depuis GitHub

1. Décompressez **l’archive des sources v3**, pas la publication binaire, puis placez son contenu à la racine d’un dépôt GitHub. `Dockerfile`, `render.yaml`, `client/` et `server/` doivent être au même niveau.
2. Vérifiez qu’aucun `.env`, mot de passe, ancien `App_Data`, fichier de base, certificat privé ou `appsettings` contenant une clé n’est suivi par Git. Les fichiers d’exclusion sont fournis mais ne retirent pas un secret déjà commité : dans ce cas révoquez/renouvelez-le.
3. Créez le projet Supabase et exécutez le SQL **avant** de démarrer le service.
4. Dans Render : **New → Web Service → connecter GitHub → choisir le dépôt → Runtime : Docker**. Dockerfile : `./Dockerfile`, contexte : racine. Choisissez la région proche du projet Supabase, par exemple Frankfurt.
5. Dans **Environment**, renseignez les huit variables principales de la section 4 (dont le modèle). Utilisez **Production** et le port **10000**. Les secrets ne sont pas des arguments de build.
6. Configurez le Health Check Path sur **`/api/health`**, puis déployez. La construction comporte deux stages déclarés : SDK (.NET + Node officiel pour `npm ci`/`npm run build`, puis publication Release linux-x64) et runtime `mcr.microsoft.com/dotnet/aspnet:8.0`. Le conteneur final tourne avec l’utilisateur non-root `app`.
7. Une fois l’URL publique connue, configurez le Pulse avec `https://ton-app.onrender.com/api/pulse`. `RENDER_EXTERNAL_URL` sert par défaut à construire le retour. Pour un domaine personnalisé, ajoutez `App__PublicUrl` et mettez à jour le Pulse.
8. Après déploiement, vérifiez l’état de santé, créez votre compte puis réalisez **vous-même un essai autorisé avec vos services**. Contrôlez la livraison Pulse et la base avant de déclarer le paiement opérationnel. Cette étape distante n’a pas été réalisée dans la livraison.

Alternative : **New → Blueprint** et sélection du même dépôt. Render lit `render.yaml` ; les entrées `sync:false` doivent être remplies. Le plan Free est explicite dans ce fichier : passez sur une offre adaptée si vous ouvrez un service commercial.

En local, avec Docker disponible et les variables exportées, vous pouvez tester l’image ainsi :

```bash
docker build -t interview-prep-ai:v3 .
docker run --rm -p 10000:10000 \
  -e Supabase__ConnectionString -e Chariow__ApiKey -e Chariow__ProductId \
  -e Chariow__PulseSecret -e Gemini__ApiKey -e Gemini__Model \
  -e App__PublicUrl interview-prep-ai:v3
```

Ne remplacez pas les `-e NOM` par des secrets écrits en clair dans un script versionné. En Production les cookies sont `Secure` ; le parcours de connexion doit être utilisé via HTTPS, comme sur Render.

## 9. UptimeRobot et limites réelles du gratuit

Rappel demandé : dans UptimeRobot, créez un moniteur **HTTP(S)** vers :

```text
https://ton-app.onrender.com/api/health
```

Choisissez une vérification toutes les **5 minutes**, si cette fréquence est disponible dans votre offre UptimeRobot, et configurez vos alertes.

**Ce n’est pas une garantie de disponibilité.** Render Free met normalement un service en veille après 15 minutes sans trafic et son réveil peut prendre environ une minute. Les requêtes du moniteur peuvent fournir du trafic, mais ne suppriment ni quotas, ni redéploiements, ni incidents, ni restrictions. Les 750 heures gratuites par espace de travail/mois sont partagées ; d’autres limites, notamment de trafic sortant, peuvent entraîner une suspension. Render indique que son offre gratuite n’est pas destinée à la production. Supabase, Chariow, Gemini et UptimeRobot ont aussi leurs propres limites et conditions.

Le disque Render est éphémère : aucune donnée métier ni clé de cookie ne dépend de ce disque. Cela ne remplace pas des sauvegardes de la base. Pour un service payant réellement exploité, prévoyez une offre d’hébergement adaptée, une supervision et un budget API.

## 10. Migrer une ancienne base SQLite v2

**Migration administrative facultative, hors ligne et vers une destination vide. Aucun compte ancien n’est payé automatiquement.**

1. Arrêtez la v2. Sauvegardez tout son `App_Data`, dont le fichier SQLite et ses éventuels fichiers WAL/SHM. Conservez l’original hors ligne ; travaillez sur une copie cohérente.
2. Exportez aussi les données locales depuis les paramètres de l’ancienne application. Les notes, favoris et brouillons IndexedDB sont attachés au navigateur **et à l’origine** : ils ne passent pas automatiquement de `http://127.0.0.1:5080` au domaine Render. Aucun import automatique de ces données locales n’est livré ; conservez cet export et l’ancien profil du navigateur.
3. Créez le schéma PostgreSQL avec la section 3. Gardez l’application v3 arrêtée. La destination doit être vide en comptes, documents, reçus et checkouts : aucune fusion ni écrasement n’est tenté.
4. Sur votre ordinateur administratif, installez Python 3.11+ et les dépendances :

```bash
python -m pip install -r tools/requirements.txt
```

5. Exportez les variables **libpq** suivantes pour l’utilitaire Python : `PGHOST`, `PGPORT=5432`, `PGDATABASE=postgres`, `PGUSER=postgres.REFERENCE_PROJET`, `PGPASSWORD` et `PGSSLMODE=verify-full`. Elles reprennent les mêmes paramètres que Npgsql mais ne sont pas la même syntaxe ; l’outil ne lit pas `Supabase__ConnectionString`. N’inscrivez pas le mot de passe dans une ligne de commande partagée, un fichier versionné ou une capture.
6. Lancez une simulation, **annulée par défaut même si tout réussit** :

```bash
python tools/migrate_sqlite.py CHEMIN_VERS_LA_COPIE_SQLITE
```

7. Vérifiez les comptes/documents annoncés puis autorisez explicitement la copie :

```bash
python tools/migrate_sqlite.py CHEMIN_VERS_LA_COPIE_SQLITE --commit
```

L’outil lit SQLite en lecture seule, vérifie GUID/JSON/propriétaires, conserve les identifiants, sels, empreintes PBKDF2 et JSON, puis copie dans une transaction PostgreSQL. Il refuse une destination non vide. Toute erreur annule l’ensemble. `is_paid=false`, `paid_at=NULL` et `chariow_sale_id=NULL` sont les valeurs initiales. Il n’invente pas d’historique de vente. Une nouvelle connexion est nécessaire : les anciens cookies locaux ne sont pas transférés.

Conservez les sauvegardes et testez connexion, export et visibilité des documents avant de retirer la v2. Les documents migrés restent exportables même si le nouveau paywall n’est pas encore activé.

## 11. Développement, tests et publication

Prérequis : **.NET SDK 8, Node 22, PostgreSQL dédié aux tests**, et éventuellement Python pour la migration. Pour du développement HTTP local uniquement, utilisez `ASPNETCORE_ENVIRONMENT=Development`. Renseignez `Supabase__ConnectionString` avec une base locale ayant reçu le SQL, `ASPNETCORE_URLS=http://0.0.0.0:5080` et, si nécessaire, `App__PublicUrl=http://localhost:5173`. La connexion PostgreSQL locale peut employer `SSL Mode=Disable` uniquement en Development.

```bash
npm ci --prefix client
npm run build --prefix client
dotnet run --project server --no-launch-profile
```

Pour le développement Vite, lancez séparément `npm run dev --prefix client`. Les appels `/api` sont relatifs ; Vite les proxyfie vers le serveur 5080. Aucune clé ne passe dans le frontend.

Les tests .NET créent puis suppriment leurs bases isolées sur l’instance indiquée par **`TEST_POSTGRES_CONNECTION`**, rôle ayant `CREATEDB`. **Ne pointez jamais les tests vers la production ou Supabase réel.** Exemple local, sans secret réel :

```bash
export TEST_POSTGRES_CONNECTION='Host=127.0.0.1;Port=5432;Database=postgres;Username=ROLE_LOCAL;SSL Mode=Disable'
npm test --prefix client
dotnet test tests -c Release
npm run build --prefix client
dotnet publish server -c Release -r linux-x64 --self-contained false -p:UseAppHost=false -o artifacts/render-linux-x64
```

`build.sh` enchaîne tests et publication Linux. Les tests de migration utilisent les variables libpq `PG*` d’un serveur local avec droit `CREATEDB` :

```bash
python -m unittest discover -s tools -p 'test_*.py' -v
```

Le résultat publié se lance avec `dotnet server.dll` dans son dossier, après configuration et SQL. Pour Windows, adaptez la syntaxe des variables (`$env:NOM` dans PowerShell) ; cette livraison cible Render Linux, et ne remplace pas un paquet Windows testé.

## 12. Exploitation et points à compléter avant ouverture commerciale

- Sauvegardez PostgreSQL et testez la restauration. Une restauration trop ancienne peut perdre des confirmations : réconciliez/rejouez les ventes concernées avant reprise.
- Les clés de protection des cookies sont persistées dans `data_protection_keys`, ce qui permet plusieurs instances/redémarrages. Leur XML **n’est pas chiffré par un certificat applicatif** : protégez strictement l’accès à la base, aux sauvegardes et aux secrets. Ne les exposez jamais au navigateur.
- Les données sont isolées par l’ID du compte dans les requêtes serveur. RLS/révocations constituent une protection supplémentaire contre l’exposition via Supabase, pas un remplacement de la vérification serveur.
- Les limites de requêtes en mémoire sont locales à chaque instance. Derrière un proxy, des visiteurs peuvent partager une adresse vue par le serveur ; adaptez les proxys de confiance et la limitation pour un déploiement à charge élevée. Aucun header de proxy arbitraire n’est implicitement considéré fiable ici.
- Aucun retrait automatique d’accès après remboursement/contestation, aucune expiration d’abonnement, aucune réinitialisation de mot de passe ni vérification d’e-mail n’est ajouté dans cette version. Définissez la procédure d’assistance et de rapprochement des ventes. Ne débloquez jamais un compte en vous fiant seulement à un e-mail.
- Pour une vente payée non activée : vérifier le bon compte et produit, la présence de `custom_metadata.user_id`, la livraison Pulse, le secret, puis rejouer la notification signée depuis Chariow. Ne demandez pas un second paiement pour résoudre un retard.
- En cas de 503 à l’offre : vérifier clé, identifiant, produit publié, prix fixe et absence de livraison/champs supplémentaires. En cas de 401 au Pulse : vérifier le secret Pulse, pas seulement la clé API.
- Le statut `/api/health` vérifie la base, pas la disponibilité réelle de tous les prestataires. `geminiConfigured=true` signale seulement une clé non vide, pas une clé validée.
- Les CV sont envoyés à Google Gemini avec consentement ; le PDF original n’est pas conservé par l’application. Les analyses peuvent être inexactes et ne prédisent pas l’embauche. Les coordonnées nécessaires au paiement sont envoyées à Chariow seulement lors de son initiation.

## 13. Références de configuration

Documentation consultée pour cette intégration ; les interfaces/offres des prestataires peuvent évoluer :

- [Chariow — Pulses et format officiel](https://chariow.dev/en/guides/pulses)
- [Chariow — sécurité des signatures](https://chariow.dev/en/guides/pulse-security)
- [Chariow — initialiser un checkout](https://chariow.dev/api-reference/checkout/init-checkout)
- [Chariow — consulter un produit](https://chariow.dev/api-reference/products/get-product)
- [Supabase — connexions PostgreSQL et poolers](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Render — services gratuits et limites](https://render.com/docs/free)

Licences des polices, icônes, composants et fournisseur PostgreSQL dans `licenses/`. Les illustrations et le logo de l’application restent les assets personnalisés livrés en v2.
