# Administrateur directement dans Supabase — v5.1

## Ce qui change

Le rôle admin est maintenant lu dans **`public.users.is_admin`** à chaque vérification serveur. La variable Render `Admin__UserId` est **ignorée**, même si elle contient un identifiant valide. Il n’y a ni repli sur cette variable, ni rôle admin conservé dans le cookie, ni cache global du rôle.

- `is_admin = true` : administration et créations sans achat.
- `is_admin = false` : compte ordinaire ; accès aux créations selon son paiement.
- **Au maximum un administrateur** : index unique partiel en base, y compris pour les écritures simultanées.
- **`is_paid` reste séparé**. Ne le modifiez pas pour devenir admin. Aucun reçu ni date de paiement fictifs ne sont créés.
- Aucun utilisateur n’est promu automatiquement, y compris le premier inscrit ou l’ancien compte choisi dans Render.

Il s’agit du rôle **dans votre application**, pas d’un rôle PostgreSQL, d’un accès au dashboard Supabase ou de Supabase Auth. La bonne table est **`public.users`**, pas `auth.users`.

## Installation, une seule fois

Le site doit recevoir ce correctif une première fois ; ensuite, les changements d’administrateur se feront uniquement dans Supabase.

### 1. Ajouter le champ et les protections

Conservez une sauvegarde appropriée avant toute modification SQL. Aucun script livré ne supprime vos comptes, vos CV, vos entretiens ou vos paiements.

Dans **Supabase → SQL Editor → New query**, exécutez intégralement :

**`mise-a-jour-supabase-v5.1.sql`** fourni à côté du ZIP, ou `database/mise-a-jour-supabase-v5.1.sql` dans l’archive.

Ce fichier réunit :

1. les ajouts de support v5, si vous ne les aviez pas encore installés ;
2. le champ admin et sa protection d’unicité v5.1.

Il peut être relancé. Si votre schéma v5 est déjà installé, vous pouvez aussi exécuter seulement `database/migration-v5.1.sql`.

Le script garde les paiements et les données existantes. Si vous aviez créé manuellement plusieurs administrateurs, la contrainte échouera au lieu d’en choisir un arbitrairement : vérifiez les comptes et conservez au maximum une valeur `true` avant de relancer.

### 2. Choisir votre compte, depuis Supabase

**La méthode simple :**

1. Ouvrez **Table Editor**.
2. Sélectionnez le schéma **public**, puis la table **users**.
3. Repérez votre ligne grâce à votre adresse e-mail de connexion. Vérifiez bien le compte.
4. Passez **`is_admin` de `false` à `true`**, puis enregistrez.
5. **Ne changez pas `is_paid`, `hash`, `salt` ou `id`.**

Vous devez choisir un compte déjà inscrit sur l’application. Si la colonne n’apparaît pas, actualisez Table Editor après l’exécution du SQL.

**Si un autre compte est déjà admin**, utilisez le script **`choisir-admin.sql`** : remplacez `REMPLACEZ-PAR-VOTRE-EMAIL` par l’e-mail exact de votre compte puis exécutez le fichier dans SQL Editor. Il retire l’ancien rôle et attribue le nouveau dans une seule transaction. S’il ne trouve pas le compte, il annule l’opération et conserve l’ancien administrateur. Si votre e-mail contient une apostrophe, doublez-la dans la chaîne SQL.

### 3. Mettre à jour le code GitHub → Render

1. Décompressez **`Mise-a-jour-Admin-Supabase-v5.1.zip`**.
2. À la **racine** du dépôt GitHub relié à Render, utilisez **Add file → Upload files**.
3. Déposez les dossiers et fichiers de la mise à jour, sans ajouter de dossier parent et sans supprimer les fichiers existants non fournis.
4. Validez avec **Commit changes** ; laissez Render déployer le nouveau commit, ou utilisez **Manual Deploy → Deploy latest commit**.

Le correctif est **cumulatif depuis v3.1, v4 ou v5** : les fichiers des pages/support et leurs dépendances sont inclus. Il conserve votre Dockerfile, le correctif TLS, les clés et la configuration de paiement existants.

**N’importez plus `admin-v5.env`.** L’ancienne variable `Admin__UserId` ne sert plus. Vous pouvez la laisser temporairement dans Render : elle est ignorée. Sa suppression est facultative et ne doit pas vous conduire à effacer les autres variables.

### 4. Ouvrir votre administration

Après le déploiement, connectez-vous à votre compte et actualisez le site avec **Ctrl + Shift + R**.

- Le menu **Administration** est disponible.
- Accès direct : `https://VOTRE-SITE/#admin`.
- Votre compte dispose d’un accès admin gratuit, même si `is_paid` est `false`.
- Les coûts et quotas du fournisseur Gemini restent applicables à l’opérateur ; gratuit dans l’application ne signifie pas API IA illimitée ou gratuite.

## Ensuite : Supabase uniquement

Pour retirer le rôle, remettez `is_admin` à `false` sur la ligne concernée. Vous pouvez également utiliser :

```sql
UPDATE public.users
SET is_admin = false
WHERE is_admin = true;
```

Cette requête retire le rôle de l’actuel administrateur sans supprimer son compte ou son paiement.

Pour désigner un autre administrateur, utilisez **`choisir-admin.sql`**. Une tentative de mettre un deuxième compte à `true` directement est refusée par la base.

**Aucun redéploiement ou changement de variable Render n’est nécessaire pour ces opérations après installation de la v5.1.** Actualisez le site pour renouveler les menus affichés. Le serveur vérifie le rôle en base lors des nouvelles requêtes, même avec une session déjà ouverte. Une opération déjà autorisée et en cours peut se terminer ; le correctif ne l’annule pas rétroactivement.

Si l’ancien admin a réellement payé, retirer son rôle ne lui retire pas son accès payé. S’il n’a jamais payé, ses nouvelles créations sont de nouveau soumises au paywall. Les notes, paramètres et demandes de support ordinaires restent accessibles selon le fonctionnement existant.

## Sécurité et limites

- Les formulaires d’inscription et de profil ne peuvent attribuer ni `is_admin` ni `is_paid`.
- Aucune API de l’application ne propose de modifier le rôle admin.
- La table `users` reste protégée par RLS et inaccessible aux rôles publics Supabase ; seules vos connexions d’administration de base autorisées peuvent modifier ce champ directement.
- Une erreur de lecture de la base ne donne pas d’accès admin de secours. Si la migration n’a pas été exécutée, la vérification de santé signale une indisponibilité au lieu de prétendre que tout est configuré.
- Supprimer le compte admin ne transfère pas son rôle au prochain inscrit.
- La consultation des comptes dans le dashboard lit directement le rôle SQL, sans faire une requête supplémentaire pour chaque utilisateur.
- Le logo texte, les pages de support, la messagerie, les animations et les règles de paiement ordinaires sont conservés.

Les instructions v5 relatives à `Admin__UserId` sont **historiques et remplacées par ce guide**. En cas de retour à l’ancien code v5, celui-ci utilisera de nouveau sa variable d’environnement : ne mélangez pas les procédures des deux versions.

## Vérifications et fichiers

La sortie des tests et de la compilation est dans **`BUILD-V5.1.txt`**. Les contrôles comprennent les changements de rôle avec cookies existants, le refus d’un second admin, les promotions concurrentes, l’ignorance de l’ancienne variable, les formulaires non autorisés, le transfert SQL et son rollback, la conservation du paiement, la révocation du support et l’échec fermé si la colonne manque.

Aucune vérification dans un navigateur, conformément à votre consigne. Les tests utilisent PostgreSQL local ; aucun SQL n’a été exécuté sur votre Supabase et aucun compte réel n’a été promu par l’assistant. Aucun paiement ou appel Gemini réel, aucun déploiement Render et aucune construction d’image Docker ici.

- `Mise-a-jour-Admin-Supabase-v5.1.zip` : mise à jour du dépôt existant.
- `Interview-Prep-AI-Sources-v5.1.zip` : sources complètes ; pour une nouvelle base, utiliser `database/schema.sql`, qui inclut tous les ajouts.
- `Interview-Prep-AI-Render-linux-x64-v5.1.zip` : résultat compilé .NET 8 / frontend, sans données ni secrets. Ce n’est pas le ZIP à téléverser dans GitHub ; Render reconstruit depuis les sources.
