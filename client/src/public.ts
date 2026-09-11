import { wordmark } from "./brand";
import { heroArt, art } from "./art";
const icon = (name: string) =>
  `<span class="icon" aria-hidden="true">${name}</span>`;
const button = (text: string, action: string, kind = "filled", i = "") =>
  `<md-${kind}-button data-act="${action}">${i ? `<md-icon slot="icon">${icon(i)}</md-icon>` : ""}${text}</md-${kind}-button>`;
export function publicHeader(signedIn = false) {
  return `<header class="public-header">${wordmark()}<nav class="marketing-nav" id="marketing-nav" aria-label="Navigation du site"><a href="#welcome/methode">La méthode</a><a href="#welcome/benefices">Votre préparation</a><a href="#pricing"><md-ripple></md-ripple>Tarif et accès</a><a href="#support">Support</a><a href="#contact">Contact</a><a class="mobile-account-link" href="#${signedIn ? "home" : "login"}">${signedIn ? "Mon espace" : "Se connecter"}</a></nav><div class="public-header-actions">${signedIn ? button("Mon espace", "go-home", "filled", "arrow_forward") : `<a href="#login" class="login-link">Se connecter</a>${button("Commencer", "register")}`}<md-icon-button class="public-menu-button" data-act="public-menu" aria-controls="marketing-nav" aria-expanded="false" aria-label="Ouvrir la navigation">${icon("menu")}</md-icon-button></div></header>`;
}
export function publicFooter() {
  return `<footer class="public-footer"><div>${wordmark()}<p>Préparez vos réponses.<br>Présentez votre expérience.</p></div><nav aria-label="Liens de bas de page"><a href="#about">À propos</a><a href="#support">Support</a><a href="#welcome/faq">Questions fréquentes</a><a href="#contact">Contact</a><a href="#legal">Mentions légales</a><a href="#privacy">Confidentialité</a><a href="#terms">Conditions d’utilisation</a></nav><div class="footer-signature"><span>Interview Prep AI</span><span>Préparation aux entretiens</span></div></footer>`;
}
export function landing(signedIn = false) {
  const start = signedIn ? "go-home" : "register";
  return `<div class="public-site">${publicHeader(signedIn)}<main id="main-content"><section class="landing-hero public-width"><div class="landing-copy"><div class="eyebrow"><span class="edition-dot"></span> LE PROCHAIN ENTRETIEN SE PRÉPARE</div><h1>Vous avez<br>l’expérience.<br><em>Trouvez les mots.<svg class="headline-stroke" viewBox="0 0 340 20" fill="none" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M7 14Q164 1 332 11"/></svg></em></h1><p class="landing-intro">Un CV ne raconte pas tout. Préparez-vous à expliquer vos choix, défendre vos compétences et parler de vos réalisations.</p><div class="landing-cta">${button("Préparer mon entretien", start, "filled", "arrow_forward")}<a class="method-link" href="#welcome/methode">Découvrir la méthode ${icon("south")}</a></div><div class="landing-facts"><span>${icon("description")} À partir de votre CV</span><span>${icon("pace")} Sans chronomètre</span></div></div><div class="landing-visual"><div class="visual-kicker"><span>LE POSTE QUE VOUS VISEZ.</span><span>LE PARCOURS QUI EST LE VÔTRE.</span></div><div class="landing-illustration">${heroArt()}</div><div class="scene-note scene-note-a" aria-hidden="true">${icon("chat_bubble")} Votre parcours</div><div class="scene-note scene-note-b" aria-hidden="true">${icon("check_circle")} Des exemples concrets</div><div class="visual-caption"><span class="caption-line"></span><p>Au-delà du CV,<br><strong>il y a votre façon d’en parler.</strong></p></div></div></section><div class="journey-strip public-width" aria-label="Les trois étapes de votre préparation"><span><b>01</b> Votre CV</span>${icon("arrow_right_alt")}<span><b>02</b> Vos réponses</span>${icon("arrow_right_alt")}<span><b>03</b> Votre bilan</span></div><section id="methode" tabindex="-1" class="landing-section public-width"><div class="landing-section-head"><div><div class="eyebrow">LA MÉTHODE</div><h2>Un entretien ne s’improvise pas.<br>Sa préparation peut rester simple.</h2></div><p>De votre CV au bilan, tout se passe dans le même espace. Vous choisissez le poste, le niveau et la longueur de l’entretien.</p></div><div class="method-grid">${[
    [
      "01",
      "Votre parcours comme point de départ",
      "Importez votre CV au format PDF. Retrouvez une synthèse de vos expériences, vos compétences et des recommandations pour votre document.",
      "cv",
    ],
    [
      "02",
      "Des questions qui vous concernent",
      "Choisissez 5 ou 8 questions et répondez par écrit. Présentation, compétences, motivation : entraînez-vous pour le poste que vous visez.",
      "practice",
    ],
    [
      "03",
      "Un retour sur vos réponses",
      "Consultez vos points forts, les passages à préciser et des exemples de reformulation. Gardez les questions à retravailler.",
      "results",
    ],
  ]
    .map(
      ([n, t, d, a]) =>
        `<article class="method-card"><div class="method-card-top"><span class="method-number">${n}</span><div class="method-art">${art(a)}</div></div><h3>${t}</h3><p>${d}</p></article>`,
    )
    .join(
      "",
    )}</div></section><section id="benefices" tabindex="-1" class="benefits-section"><div class="public-width benefits-grid"><div><div class="eyebrow">CE QUE VOUS ALLEZ TRAVAILLER</div><h2>Des réponses préparées.<br><em>Pas un texte à réciter.</em></h2><p>Le but n’est pas de trouver une formule parfaite. C’est d’appuyer chaque réponse sur un exemple que vous saurez expliquer.</p><a href="#${signedIn ? "practice" : "register"}" class="text-arrow">Commencer ma préparation ${icon("arrow_forward")}</a></div><div class="benefits-list">${[
    [
      "01",
      "Mettre en valeur vos réalisations",
      "Choisissez les expériences pertinentes et expliquez votre contribution avec précision.",
    ],
    [
      "02",
      "Structurer votre réponse",
      "Décrivez la situation, votre action et son résultat. Identifiez ce qui manque à votre argumentation.",
    ],
    [
      "03",
      "Revenir sur les points difficiles",
      "Conservez vos notes et vos questions favorites. Reprenez une session avant de consulter son bilan.",
    ],
  ]
    .map(
      ([n, t, d]) =>
        `<article><span>${n}</span><div><h3>${t}</h3><p>${d}</p></div></article>`,
    )
    .join(
      "",
    )}</div></div></section><section id="faq" tabindex="-1" class="landing-section public-width faq-section"><div><div class="eyebrow">AVANT DE COMMENCER</div><h2>Vos questions,<br>nos réponses.</h2><p>Voici ce qu’il faut savoir pour préparer votre premier entretien.</p></div><div class="faq-list">${[
    [
      "Faut-il déjà avoir une offre d’emploi ?",
      "Non. Un CV et le nom du poste visé suffisent. Vous choisissez aussi votre niveau : débutant, intermédiaire ou confirmé.",
    ],
    [
      "L’entretien se déroule-t-il à l’oral ?",
      "Cette version propose un entretien écrit. Vous répondez à 5 ou 8 questions, sans limite de temps. Elle ne propose pas encore d’appel vocal ou vidéo.",
    ],
    [
      "Puis-je interrompre ma préparation ?",
      "Oui. Les brouillons sont conservés dans ce navigateur. Les réponses validées et les sessions sont enregistrées dans votre compte. Utilisez le même appareil pour retrouver un brouillon non validé.",
    ],
    [
      "Que signifie le score du bilan ?",
      "Il résume la pertinence, la structure et la précision de vos réponses. Il s’agit d’un repère d’entraînement, pas d’une prédiction d’embauche. Les retours automatiques peuvent contenir des erreurs.",
    ],
    [
      "Comment mon CV est-il utilisé ?",
      "Votre accord est demandé avant son analyse par notre prestataire de traitement. Le fichier original n’est pas conservé sur notre serveur ; son analyse est enregistrée dans votre compte. Les détails sont disponibles dans la politique de confidentialité.",
    ],
  ]
    .map(
      ([q, a]) =>
        `<details><summary>${q}<span class="faq-toggle">+</span></summary><p>${a}</p></details>`,
    )
    .join(
      "",
    )}<button class="privacy-text-link" data-act="privacy">Consulter la confidentialité ${icon("north_east")}</button></div></section><section class="closing-cta public-width"><div><div class="eyebrow">À VOUS DE PRÉPARER LA SUITE</div><h2>Le prochain entretien.<br>Avec des réponses plus précises.</h2><p>Créez votre compte et commencez par votre CV.</p></div>${button(signedIn ? "Retrouver mon espace" : "Créer mon compte", start, "filled", "arrow_forward")}</section></main>${publicFooter()}</div>`;
}
export function authPage(mode: "register" | "login") {
  const register = mode === "register";
  return `<div class="auth-page">${publicHeader()}<main class="auth-layout public-width" id="main-content"><section class="auth-editorial"><div class="eyebrow">INTERVIEW PREP AI</div><h1>Votre CV ouvre<br>la conversation.<br><em>Préparez la suite.</em></h1><p>Retrouvez vos documents, travaillez vos réponses et conservez vos bilans dans votre espace personnel.</p><div class="auth-editorial-art">${heroArt()}</div></section><section class="auth-card" aria-labelledby="auth-title"><a href="#welcome" class="auth-back">${icon("arrow_back")} Retour au site</a><h2 id="auth-title">${register ? "Créer votre compte" : "Se connecter"}</h2><p class="auth-subtitle">${register ? "Votre espace de préparation, en quelques instants." : "Retrouvez vos CV et vos entretiens."}</p><form id="auth-form" novalidate><div class="form-stack">${register ? '<md-outlined-text-field id="auth-name" label="Votre prénom ou nom" autocomplete="name" required minlength="2" maxlength="60"></md-outlined-text-field>' : ""}<md-outlined-text-field id="auth-email" label="Adresse e-mail" type="email" autocomplete="email" required maxlength="200"></md-outlined-text-field><md-outlined-text-field id="auth-password" label="Mot de passe" type="password" autocomplete="${register ? "new-password" : "current-password"}" required minlength="${register ? 10 : 1}" maxlength="128" supporting-text="${register ? "10 caractères minimum. Choisissez un mot de passe unique." : ""}"><md-icon-button type="button" slot="trailing-icon" data-act="toggle-password" aria-label="Afficher le mot de passe">${icon("visibility")}</md-icon-button></md-outlined-text-field><div class="form-error" id="auth-error" role="alert"></div>${button(register ? "Créer mon compte" : "Me connecter", register ? "submit-register" : "submit-login", "filled", "arrow_forward")}</div></form><p class="auth-switch">${register ? "Vous avez déjà un compte ?" : "Vous n’avez pas encore de compte ?"}<a href="#${register ? "login" : "register"}">${register ? "Se connecter" : "Créer un compte"}</a></p><p class="auth-privacy">Aucun CV n’est transmis à l’inscription. Votre accord sera demandé avant son analyse.<button data-act="privacy">Confidentialité</button></p></section></main>${publicFooter()}</div>`;
}
