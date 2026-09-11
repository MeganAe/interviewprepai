# V5 — Logo texte, pages publiques, support et administration

> **Guide historique v5.** Dans la v5.1, la gestion du rôle par variable Render est remplacée par `public.users.is_admin`. Consultez `ADMIN-SUPABASE-V5.1.md` : n’importez plus `admin-v5.env` et n’utilisez plus `Admin__UserId`. Les autres fonctionnalités v5 sont conservées.

## Ce qui est livré

- **Logo « Interview Prep AI » uniquement typographique** : Roboto Serif, sans pictogramme, sans badge et sans pastille « AI ». Intégré aux en-têtes, pieds de page et écrans de chargement. Favicon « IP » en lettres uniquement. Les fichiers SVG de marque sont vectorisés.
- **Pages publiques** : À propos (`#about`), Support / aide recherchable (`#support`), Contact (`#contact`), Mentions légales (`#legal`), Confidentialité (`#privacy`), Conditions d’utilisation (`#terms`). Les liens sont intégrés à la navigation et aux pieds de page. La consultation de la confidentialité pendant l’inscription conserve le formulaire grâce à une fenêtre Material.
- **Messagerie privée** : `#tickets`, création depuis Contact, conversations, réponses, fermeture/réouverture et export JSON. Accessible aux comptes connectés, même sans paiement. Pas d’envoi d’e-mail, de pièces jointes ni de faux chat en direct. Les messages sont réellement enregistrés dans PostgreSQL.
- **Dashboard admin** : `#admin`, compteurs réels, utilisateurs (`#admin/users`), paiements enregistrés (`#admin/payments`), demandes et réponses (`#admin/tickets`), coordonnées publiques de l’éditeur (`#admin/site`). Recherche, filtres et pagination fonctionnent côté serveur.
- **Accès gratuit de l’admin** : analyses de CV, entretiens et bilans sans achat. Les quotas et coûts du fournisseur Gemini restent applicables à l’opérateur.
- Thème Amber clair, Roboto Serif, Material Web, en-têtes flottants et animations conservés. Nouvelles pages adaptatives, tableaux à défilement contenu, navigation admin horizontale sur mobile, animations désactivables avec `prefers-reduced-motion`.

**Aucune donnée utilisateur de démonstration, aucun faux paiement et aucun chiffre d’affaires inventé.** Les reçus existants ne contiennent pas les montants historiques : l’administration montre donc des références et des compteurs, pas un revenu fictif.

## Important avant de commencer

Cette version n’est **pas seulement une mise à jour visuelle**. Elle ajoute trois tables de support/informations publiques et une variable d’environnement pour votre compte admin.

- Conservez votre connexion Supabase, vos clés Chariow/Gemini, le certificat Secret File `supabase-ca.crt` et le Dockerfile TLS déjà fonctionnels.
- **Ne remplacez pas votre fichier d’environnement complet par celui de cette mise à jour.** Le fichier `admin-v5.env` ne contient que le nouveau réglage admin.
- Ne videz aucune table et ne marquez pas votre compte comme payé manuellement.
- Conservez une sauvegarde appropriée de votre base avant toute modification SQL. Le script livré est additif et peut être relancé ; il ne supprime pas les comptes ni les créations existantes.

## 1. Ajouter les tables de la v5 dans Supabase

Dans **Supabase → SQL Editor → New query** :

1. Ouvrez `database/migration-v5.sql` dans la mise à jour.
2. Copiez **tout son contenu** dans SQL Editor et exécutez-le.
3. Attendez le succès avant de déployer le code v5.

Ce script ajoute uniquement :

- `support_tickets` : demandes liées à un compte ;
- `support_messages` : messages et réponses ;
- `site_settings` : informations publiques de l’éditeur et version d’édition.

Les nouvelles tables ont RLS activé et aucune permission pour les rôles publics Supabase. Le serveur Npgsql, déjà configuré, les utilise comme les tables de l’application existante. Aucun utilisateur n’est promu par ce SQL.

Le fichier `database/schema.sql` contient désormais le schéma complet pour une **installation neuve**. Pour votre site déjà déployé, le petit script `migration-v5.sql` suffit. Ne réutilisez pas un ancien extrait SQL de la documentation v3 comme schéma complet v5.

## 2. Identifier votre compte existant

Aucun e-mail n’a été fourni pour le compte administrateur : **aucun compte réel n’a donc été désigné automatiquement dans cette livraison.**

Vous avez deux possibilités :

### Avant le déploiement, avec Supabase

Exécutez cette lecture, en remplaçant l’adresse d’exemple par celle du compte que **vous avez déjà créé** :

```sql
SELECT id, name, email
FROM public.users
WHERE email = lower('VOTRE-EMAIL-DE-CONNEXION');
```

Vérifiez que la ligne correspond bien à votre compte. Copiez uniquement la valeur de la colonne **`id`**, sous la forme `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

Ce n’est ni l’identifiant du projet Supabase, ni une clé API, ni l’e-mail. Si aucune ligne n’est trouvée, vérifiez votre adresse ou connectez-vous/créez d’abord votre compte ordinaire sur le site.

### Après le déploiement, depuis le site

Connectez-vous, ouvrez **Paramètres → Votre profil → Identifiant de ce compte**, puis copiez cet identifiant. Les paramètres sont accessibles sans paiement.

## 3. Déployer les fichiers puis activer votre rôle

### Code GitHub

1. Téléchargez et décompressez **`Mise-a-jour-Admin-Support-v5.zip`**.
2. Ouvrez la **racine** du dépôt GitHub relié à Render, sur sa branche déployée.
3. Avec **Add file → Upload files**, déposez les dossiers `client`, `server`, `database`, `branding`, `docs`, `tools`, `tests`, `licenses` et les fichiers de documentation présents dans le ZIP. Ne déposez pas le ZIP lui-même et ne créez pas de dossier parent supplémentaire.
4. Conservez les fichiers existants non fournis. Le correctif est cumulatif : il s’applique à la version fonctionnelle v3.1 ou à la v4. Les fichiers et licences de l’amélioration visuelle v4 nécessaires sont inclus, même si vous n’aviez pas encore installé la v4. Les correctifs Chariow/TLS déjà en place sont conservés. Le fichier `server/appsettings.json` fourni ne contient aucun secret ; vos variables Render gardent la priorité.
5. Validez avec **Commit changes**. Render doit reconstruire ce nouveau commit ; sinon utilisez **Manual Deploy → Deploy latest commit**.

### Une seule nouvelle variable Render

Dans **Render → votre service → Environment**, ajoutez :

```text
Admin__UserId=IDENTIFIANT-EXACT-DE-VOTRE-COMPTE
```

Vous pouvez aussi télécharger `admin-v5.env`, remplir l’unique valeur avec votre identifiant, puis utiliser **Add from .env** pour importer **cette seule entrée**, sans effacer les autres variables existantes. N’envoyez pas votre environnement de production dans GitHub.

Enregistrez et redéployez/redémarrez le service pour appliquer la variable. Aucun réglage Chariow, Gemini, SSL ou URL publique ne doit changer.

**Valeur vide, invalide, liste de plusieurs identifiants ou identifiant ne correspondant à aucun compte : aucun administrateur utilisable.** L’application n’attribue jamais ce rôle au premier inscrit ni à un compte dont l’e-mail semble être celui d’un administrateur.

## 4. Utiliser votre espace admin

Après le déploiement, actualisez avec **Ctrl + Shift + R**, puis connectez-vous à votre compte :

- Le lien **Administration** apparaît dans le menu latéral (bouton menu sur mobile).
- Accès direct : `https://VOTRE-SITE/#admin`.
- Dans Paramètres et Tarif et accès, votre compte affiche l’accès admin gratuit.
- Vous pouvez importer votre propre CV et créer des entretiens sans passer par Chariow.
- Dans **Informations publiques**, renseignez les coordonnées de l’éditeur. Elles apparaîtront sur les pages Contact et légales. N’y saisissez que des informations que vous acceptez de rendre publiques.
- Dans **Support**, ouvrez une demande, répondez puis fermez-la si nécessaire. L’utilisateur lit la réponse dans **Mes demandes**, sans e-mail automatique.

Pour retirer l’accès admin : videz `Admin__UserId`, enregistrez et redémarrez le service. Pour le transférer : remplacez la valeur par l’identifiant exact du compte voulu. Il n’y a toujours qu’un seul compte sélectionné. Cette opération ne crée, ne retire ou ne rembourse aucun paiement.

## Autorisations et confidentialité

- La session authentifiée contient l’identifiant du compte. Le serveur compare cet identifiant à la configuration admin à chaque requête concernée. Un champ de formulaire, une valeur JavaScript ou un paramètre `is_admin` ne peut pas accorder le rôle.
- Le serveur contourne le paywall **uniquement** pour le compte sélectionné. Les autres comptes restent soumis au paiement et aux contrôles existants.
- `is_paid` reste le fait historique du paiement. Le compte admin obtient `is_admin=true` et `has_access=true`, sans écrire de faux reçu ni de fausse date de paiement. Un checkout admin est arrêté avant tout appel à Chariow.
- Les paiements des comptes ordinaires continuent à dépendre des Pulses signés, des métadonnées serveur et de l’idempotence. Les formats `successful.sale` et `sale.completed` sont conservés.
- Le dashboard admin ne permet pas de consulter les CV, réponses ou bilans individuels. Il ne retourne ni hashes de mots de passe, ni sels, ni secrets, ni corps de notifications de paiement. L’opérateur de l’infrastructure conserve les capacités techniques attachées à son hébergement ; il ne s’agit pas d’un chiffrement de bout en bout.
- Les tickets sont limités à leur propriétaire ou à l’admin. L’identité et le rôle de l’auteur sont fixés côté serveur, jamais pris dans les champs envoyés.
- Création d’un ticket et premier message dans une transaction ; identifiants de requête uniques pour les réessais et envois concurrents ; réponses et changements d’état sérialisés par verrou sur la demande.
- Champs validés, messages affichés en texte échappé, requêtes SQL paramétrées, limitation de débit, pagination et protection des écritures conservée.
- Une édition concurrente des coordonnées publiques est refusée plutôt que d’écraser silencieusement le travail d’un autre onglet.
- Supprimer le compte efface ses tickets et messages associés. L’export de support ne contient que les demandes appartenant au compte connecté, y compris pour l’administrateur.

## Limites explicites

- Pas de notification e-mail ni d’assistance en temps réel. La réinitialisation de mot de passe par e-mail n’est pas ajoutée ; sans session, une adresse publique renseignée par l’éditeur reste nécessaire pour le contacter hors application.
- Pas de remboursement, suspension de compte ou attribution d’accès payant depuis le dashboard : vous avez choisi le périmètre d’administration essentiel. La gestion financière reste chez Chariow.
- Les pages légales décrivent le fonctionnement réel, mais les coordonnées, conditions commerciales et obligations propres à l’éditeur doivent être finalisées. Aucune société, adresse, durée de remboursement ou validation juridique n’a été inventée.
- Les nouveaux formulaires gardent leur contenu après une erreur tant que la page reste ouverte ; ils ne sauvegardent pas automatiquement un ticket non envoyé dans le stockage local. Après une interruption réseau, vérifiez la liste avant de créer une autre demande.
- Les erreurs et accès privés sont gérés, mais il ne s’agit pas d’une garantie d’absence de bug.

## Vérifications et livrables

- **93 tests frontend DOM/structure**, dont 24 tests des nouvelles pages et un parcours supplémentaire d’accès admin dans le routeur réel.
- **115 tests .NET/API**, sur PostgreSQL local UTF-8, dont 23 tests/cas supplémentaires d’administration et de support.
- **5 tests de migration**, soit **213 tests réussis**.
- Un parcours admin complet CV → questions → réponses → bilan est testé avec un fournisseur IA simulé, sans paiement ni faux reçu.
- Compilation frontend de production et publication .NET 8 Release **Linux x64**, framework-dependent (`--self-contained false`, `UseAppHost=false`).
- Sortie détaillée dans `BUILD-V5.txt`. Audit des dépendances de production : aucune vulnérabilité signalée lors du contrôle. Deux signalements modérés restent dans l’outillage de développement Vitest/@vitest/mocker, non livré dans le conteneur final.

**Aucune vérification dans un navigateur**, conformément à votre consigne. Les tests DOM n’évaluent pas la géométrie réelle à 412 × 892. Aucun déploiement sur votre compte Render, aucune modification de votre Supabase et aucun paiement ou appel Gemini réel n’ont été effectués. L’image Docker n’a pas été construite ici.

Fichiers :

- `Mise-a-jour-Admin-Support-v5.zip` : correctif à déposer dans votre dépôt existant.
- `Interview-Prep-AI-Sources-v5.zip` : sources complètes ; pour une installation neuve, utiliser le schéma complet `database/schema.sql` puis la configuration de déploiement documentée dans `LIRE-MOI.md`.
- `Interview-Prep-AI-Render-linux-x64-v5.zip` : résultat compilé, sans base de données ni secrets. Il nécessite ASP.NET Core Runtime 8 et le schéma v5. **Ce n’est pas le ZIP à téléverser dans GitHub** : Render reconstruit depuis les sources.
- `branding/interview-prep-logo.svg` / `.png` : logo texte seul ; `branding/identite-v5.png` : planche du logo, pas une capture du site.

En cas de retour temporaire au code v4, conservez les nouvelles tables : elles n’empêchent pas l’ancien code de fonctionner. L’ancienne v4 ne possède toutefois ni le dashboard ni l’exemption de paiement admin.
