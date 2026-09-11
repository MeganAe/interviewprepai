# V4 — Identité et mouvement

Mise à jour visuelle du 11 septembre 2026. Le backend PostgreSQL/Chariow, le schéma SQL, les cookies et les règles d'accès restent inchangés.

## Ce qui change

- **Nouveau logo d'entretien** : deux interlocuteurs, une table et une bulle de conversation. Le monogramme iP précédent est remplacé dans les en-têtes, la navigation, les pages publiques et le favicon. Le mot-symbole reste en Roboto Serif ; les fichiers SVG de marque ont une typographie vectorisée, sans dépendance à une police externe.
- **Nouvelle illustration éditoriale** : un échange candidat/interlocuteur, avec document sur la table. Elle remplace la personne seule devant son ordinateur. L'illustration ne prétend pas que l'application propose un entretien vidéo : le parcours reste écrit et la FAQ le précise.
- **En-têtes suspendus** : barres publiques et espace personnel sticky, décollées du bord, coins arrondis, fond légèrement translucide, flou et ombre qui se renforcent au défilement. Une ligne indique la progression dans la page. Le menu mobile reste accessible, limité à la hauteur disponible.
- **Mouvement** : entrées en cascade, arrivée inversée lors du retour, révélations au défilement, réactions des cartes au pointeur, relief, flèches et icônes réactives, pression des boutons et ripple Material sur les liens classiques.
- **Scène d'accueil vivante** : bulles de conversation en apparition décalée, accent dessiné sous le titre et petits cartouches éditoriaux. Pas de statistiques inventées, de faux avis ou de contenu utilisateur de démonstration.
- **Accordéons et menus** : déploiement adouci du menu et du FAB ; ouverture/fermeture de la FAQ interpolée lorsque le navigateur prend en charge `interpolate-size`. Repli natif immédiat ailleurs.
- **Mobile** : marges de 16 px, en-têtes flottants compacts, navigation basse suspendue et respect des zones de sécurité du téléphone. Les styles visent notamment le portrait 412 × 892 ; le rendu n'a pas été vérifié dans un navigateur.

## Animation et accessibilité

La dépendance **Motion 13.2.0** est verrouillée dans `client/package-lock.json`. Seule son entrée légère `motion/mini` est utilisée, avec les API natives d'animation et IntersectionObserver. La documentation est https://motion.dev/docs/animate. Les contrôles restent les composants standards Material Web ; aucun remplacement par une autre bibliothèque UI.

- Pas de défilement capturé ou de bibliothèque de smooth-scroll qui bloque le navigateur.
- Pas de carrousel automatique, de texte clignotant ou de décoration en boucle sans fin. Les animations d'introduction se stabilisent en moins de cinq secondes.
- `prefers-reduced-motion` est respecté, y compris lorsqu'il change pendant l'utilisation. Les animations actives sont annulées et le contenu reste visible.
- Les animations et observateurs sont nettoyés à chaque changement de vue. Les champs ne sont pas clonés pour simuler une transition.
- Le contenu n'est jamais masqué en attendant un observateur : si les animations ne sont pas disponibles, l'interface reste utilisable.
- Les effets de suivi du pointeur sont désactivés au tactile et avec réduction des mouvements.
- Aucun appel de paiement ou changement de données n'est déclenché par une animation.

## Mettre à jour le site déjà déployé

**Utilisez `Mise-a-jour-Visuelle-v4.zip`. Il ne remplace ni votre Dockerfile, ni le serveur, ni votre configuration Supabase/Chariow.**

1. Téléchargez puis décompressez le ZIP.
2. Ouvrez à la racine le dépôt GitHub relié à Render, sur la branche déployée.
3. **Add file → Upload files** : déposez les dossiers `client`, `branding`, `licenses` et `docs` contenus dans cette mise à jour. Ne déposez pas le ZIP lui-même et n'ajoutez pas de dossier parent « Mise-a-jour-Visuelle-v4 » dans le dépôt. Ne supprimez pas les dossiers existants.
4. Le remplacement **des deux fichiers `client/package.json` et `client/package-lock.json` est indispensable** : Render installera Motion automatiquement avec `npm ci`. Ne copiez pas seulement les fichiers CSS.
5. Validez avec **Commit changes**. Attendez le déploiement de ce nouveau commit dans Render. Si le déploiement automatique n'est pas actif : **Manual Deploy → Deploy latest commit**.
6. Actualisez le site. Si l'ancien logo apparaît encore : **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (macOS).

**Aucun SQL à exécuter, aucune base à vider, aucun compte à supprimer et aucun secret à modifier.** Conservez le certificat CA Supabase et le Dockerfile SSL déjà fonctionnels. N'envoyez aucune clé ni donnée de compte dans GitHub.

## Livrables

- `Mise-a-jour-Visuelle-v4.zip` : fichiers modifiés et nouveaux fichiers à appliquer au dépôt existant.
- `Interview-Prep-AI-Sources-v4.zip` : sources complètes pour repartir sur un nouveau dépôt. Le Dockerfile complet conserve le correctif TLS : Secret File Render `supabase-ca.crt` nécessaire avec VerifyFull.
- `Interview-Prep-AI-Render-linux-x64-v4.zip` : résultat compilé, frontend dans `wwwroot`, backend .NET 8 et licences. Ce n'est pas le ZIP à téléverser dans GitHub ; Render reconstruit depuis les sources.
- `branding/interview-prep-logo.svg` / `.png` : logo horizontal, typographie vectorisée, fond transparent.
- `branding/interview-prep-symbol.svg` : symbole seul.
- `branding/identite-v4.png` : planche d'identité et d'illustration, **pas une capture du site dans un navigateur**.

## Vérifications

La sortie exacte des tests et de la compilation se trouve dans `BUILD-V4.txt`.

- 68 tests DOM/structure/CSS, dont 12 tests du système d'animation et du logo.
- 92 tests .NET/API sur un vrai PostgreSQL local isolé.
- 5 tests de migration SQLite → PostgreSQL.
- **165 tests**, compilation frontend de production et publication .NET Release Linux x64.

Aucune vérification navigateur, aucun déploiement sur votre compte Render et aucun appel de paiement/Gemini réel pour cette mise à jour. L'image Docker n'a pas été construite dans cet environnement. Le fichier PNG d'identité a été généré à partir des SVG, indépendamment du navigateur.

Les deux signalements npm modérés du précédent correctif concernent l'outillage de développement Vitest/@vitest/mocker, non livré dans le conteneur final. Aucun changement majeur de cet outillage n'a été forcé pour cette refonte visuelle. Les dépendances de production et les licences Motion sont contrôlées dans la sortie de build.
