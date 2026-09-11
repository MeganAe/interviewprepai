# Correctif Chariow — 11 septembre 2026

## Problème constaté

Le site répondait HTTP 502 sur `/api/checkout/offer` avec « Configuration de livraison invalide ». La connexion Supabase était déjà rétablie. Le code exigeait que `settings.is_requires_shipping_address` soit présent et strictement booléen. Il rejetait aussi les valeurs optionnelles et les représentations 0/1 ou textuelles.

La valeur brute renvoyée par le produit réel n'a pas été obtenue : aucune clé Chariow n'a été demandée ou utilisée. Le correctif couvre explicitement ces variantes et conserve le rejet des autres représentations ambiguës. Aucun paiement réel n'a été initié par l'assistant.

## Changements

- `server/Payments/ChariowClient.cs` : les paramètres ou drapeaux absents/nulls ne déclarent pas de livraison requise. `false`, `0`, `"0"`, `"false"` et une chaîne vide signifient non ; `true`, `1`, `"1"` et `"true"` signifient oui. Les chaînes sont normalisées pour les espaces et la casse. Une livraison requise reste interdite pour cette intégration numérique. Une forme inconnue reste refusée. Les restrictions produit/prix/champs supplémentaires restent actives, avec des messages plus précis.
- `client/src/payments.css` : le lien Accès du menu latéral utilise la police Material Symbols complète, car `credit_card` n'est pas présent dans le petit sous-ensemble rempli utilisé pour les autres liens actifs. L'icône est bornée à 24 px. Le correctif couvre aussi le menu mobile.
- `tests/PaymentTests.cs`, `tests/ShippingFlagTests.cs`, `client/tests/payments.test.ts` : tests de compatibilité, refus des valeurs ambiguës, absence d'activation automatique et régression CSS.

Les signatures Pulse, l'idempotence, le lien au compte authentifié et le paywall restent inchangés.

## Appliquer le petit ZIP au dépôt existant

1. Décompressez `Correctif-Chariow-v3.1.zip` sur votre ordinateur.
2. Ouvrez le dépôt GitHub utilisé par Render, sur la branche déployée (généralement `main`).
3. À la **racine du dépôt**, cliquez sur **Add file → Upload files**.
4. Glissez les dossiers **server**, **client** et **tests** présents dans le ZIP. Ils ne contiennent que les fichiers modifiés/ajoutés. Les chemins doivent rester `server/Payments/ChariowClient.cs`, `client/src/payments.css`, etc. N'ajoutez pas de dossier « Correctif-Chariow-v3.1 » autour de ces chemins et ne téléversez pas simplement le ZIP.
5. Vérifiez les fichiers proposés puis cliquez sur **Commit changes**. Ne supprimez aucun dossier existant du dépôt.
6. Render doit déployer ce commit. Sinon : **Manual Deploy → Deploy latest commit**. Attendez la fin du déploiement du **nouveau commit**, et pas seulement l'état Live d'une ancienne version.
7. Rechargez `https://interviewprepai-n4u3.onrender.com/#pricing`, puis « Recharger le tarif » si nécessaire. Vous pouvez également consulter `/api/checkout/offer` pour voir le prix ou le message précis restant.

**Aucune modification SQL, aucune réinitialisation de base, aucune suppression de compte et aucune modification des secrets ne sont nécessaires pour ce correctif.** Conservez votre Dockerfile SSL déjà fonctionnel et le certificat Supabase dans Render.

Si une autre erreur apparaît (produit non publié, type service/coaching, prix libre, champs supplémentaires…), suivez le message : ce correctif ne rend pas tous les produits Chariow compatibles. Envoyez seulement le message d'erreur, jamais vos clés, mots de passe ou données de carte.

## Vérifications de cette livraison

- 92 tests .NET/API sur PostgreSQL local réel.
- 56 tests DOM/CSS HappyDOM/Vitest, sans navigateur.
- 5 tests de migration sur PostgreSQL local.
- **153 tests réussis**, compilation frontend et publication .NET Release Linux x64.
- Voir `BUILD-CORRECTIF-CHARIOW.txt` pour la sortie exacte.

L'API de production a seulement été consultée en lecture avant correction pour confirmer le message 502. Le correctif n'a pas été déployé par l'assistant sur le compte Render. Aucun test de paiement réel, aucune vérification navigateur, aucune construction de l'image Docker dans cet environnement.

Audit npm au 11 septembre 2026 : deux entrées de sévérité modérée concernent les dépendances de développement Vitest/@vitest/mocker. Elles ne sont pas incluses dans le résultat publié ni dans le conteneur final ; aucun serveur Vitest n'est exposé. Aucun `npm audit fix --force` ni changement majeur de dépendances n'a été appliqué pour ce correctif ciblé.

## Fichiers complémentaires

- `Interview-Prep-AI-Sources-v3.1.zip` : dépôt source complet à jour, dont le Dockerfile SSL qui lit `PGSSLROOTCERT=/etc/secrets/supabase-ca.crt` et utilise l'utilisateur non-root `app:1000`. Si vous repartez de cette archive complète, le certificat CA officiel Supabase doit être présent dans Render sous le nom Secret File **supabase-ca.crt**.
- `Interview-Prep-AI-Render-linux-x64-v3.1.zip` : résultat compilé, pas le ZIP à téléverser dans GitHub pour corriger le code. ASP.NET Core Runtime 8 et PostgreSQL configuré sont nécessaires pour l'exécuter.
