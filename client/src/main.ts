import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/icon/icon.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/switch/switch.js";
import "@material/web/dialog/dialog.js";
import "@material/web/ripple/ripple.js";
import "@material/web/fab/fab.js";
import "@material/web/progress/circular-progress.js";
import "@material/web/progress/linear-progress.js";
import { get, set, del } from "idb-keyval";
import "./style.css";
import { art, heroArt } from "./art";
import { wordmark } from "./brand";
import { landing, authPage, publicHeader, publicFooter } from "./public";
import {
  checkPaymentStatus,
  hasAccess,
  CheckoutError,
  type PaymentStatus,
} from "./services/checkout";
import { pricingPage, mountPricing } from "./pages/pricing";
import { merciPage, mountMerci } from "./pages/merci";
import "./payments.css";
import "./refinements.css";
import "./expressive.css";
import "./hub.css";
import { hubPage, mountHub, isHubRoute, publicHubRoutes } from "./pages/hub";
import { initSiteMotion } from "./services/motion";

type User = { id: string; name: string; email: string; is_admin?: boolean };
type CV = {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  analysis: { role: string; summary: string; skills: string[]; tips: string[] };
};
type Question = { category: string; text: string; hint: string };
type Result = {
  score: number;
  summary: string;
  criteria: { name: string; score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  feedback: { comment: string; example: string }[];
};
type Session = {
  id: string;
  role: string;
  level: string;
  cvName: string;
  createdAt: string;
  completedAt?: string;
  questions: Question[];
  answers: string[];
  result: Result | null;
};
type Note = { id: string; title: string; body: string; updatedAt: string };
type LocalData = {
  notes: Note[];
  favorites: string[];
  drafts: Record<string, string[]>;
  notifications: boolean;
};
let user: User | null = null,
  cvs: CV[] = [],
  sessions: Session[] = [],
  local: LocalData = freshLocal();
let ready = false,
  search = "",
  historyFilter = "all",
  savedTab = "notes",
  currentQuestion = 0,
  lastSession = "",
  selectedFile: File | null = null,
  modalBusy = false,
  toastTimer = 0,
  backward = false;
const app = document.querySelector<HTMLDivElement>("#app")!;
const modalRoot = document.querySelector<HTMLDivElement>("#modal-root")!;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (name: string) =>
  `<span class="icon" aria-hidden="true">${name}</span>`;
const mi = (name: string) => `<md-icon slot="icon">${icon(name)}</md-icon>`;
const ripple = "<md-ripple></md-ripple>";
const date = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const btn = (
  label: string,
  action: string,
  ico = "",
  type = "filled",
  extra = "",
) =>
  `<md-${type}-button data-act="${action}" ${extra}>${ico ? mi(ico) : ""}${label}</md-${type}-button>`;
const ib = (name: string, label: string, action: string, extra = "") =>
  `<md-icon-button aria-label="${esc(label)}" title="${esc(label)}" data-act="${action}" ${extra}>${icon(name)}</md-icon-button>`;
function freshLocal(): LocalData {
  return { notes: [], favorites: [], drafts: {}, notifications: true };
}
let payment: PaymentStatus | null = null;
let dataLoaded = false,
  gatePending = false,
  gateError = "",
  gateVersion = 0;
let disposePaymentPage = () => {};
let pendingRoute = "home";
let renderedHash = "";
function route() {
  return location.hash.slice(1) || (user ? "home" : "welcome");
}
function isPublicRoute(r: string) {
  return (
    r === "welcome" ||
    r.startsWith("welcome/") ||
    r === "login" ||
    r === "register" ||
    r === "pricing" ||
    publicHubRoutes.includes(r.split("?")[0])
  );
}
function nav(page: string, replace = false) {
  if (modalBusy) {
    toast("Une opération est en cours. Attendez sa fin pour changer de page.");
    return;
  }
  closeModal();
  if (route() !== page || !location.hash)
    history[replace ? "replaceState" : "pushState"](
      { prep: true },
      "",
      `#${page}`,
    );
  backward = false;
  applyRoute();
}
async function applyRoute() {
  const version = ++gateVersion;
  gatePending = false;
  gateError = "";
  closeModal();
  let r = route();
  if (ready && !user && !isPublicRoute(r)) {
    pendingRoute = r === "home" ? "home" : r;
    r = r === "home" ? "welcome" : "login";
    history.replaceState({ prep: true }, "", `#${r}`);
  } else if (ready && user && (r === "login" || r === "register")) {
    history.replaceState({ prep: true }, "", "#home");
  }
  renderedHash = location.hash;
  if (ready && user && needsPayment(route())) {
    gatePending = true;
    render();
    try {
      const status = await checkPaymentStatus();
      if (version !== gateVersion) return;
      payment = status;
      if (user) user.is_admin = status.is_admin === true;
      if (!hasAccess(status)) {
        cvs = [];
        sessions = [];
        dataLoaded = false;
        nav("pricing", true);
        return;
      }
      if (!dataLoaded) await refreshRecords();
      if (version !== gateVersion) return;
    } catch (error) {
      if (version !== gateVersion) return;
      if (error instanceof CheckoutError && error.status === 401) {
        paymentAuthExpired();
        return;
      }
      gateError =
        error instanceof Error
          ? error.message
          : "Vérification de l’accès impossible.";
    } finally {
      if (version === gateVersion) gatePending = false;
    }
  }
  render();
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  const section = route().startsWith("welcome/") ? route().split("/")[1] : "";
  if (["methode", "benefices", "faq"].includes(section))
    requestAnimationFrame(() => {
      const el = document.getElementById(section);
      el?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? ("instant" as ScrollBehavior)
          : "smooth",
      });
      el?.focus({ preventScroll: true });
    });
}
function toast(message: string) {
  const t = document.querySelector("#toast")!;
  t.textContent = message;
  t.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove("show"), 5500);
}
async function persist(strict = false): Promise<boolean> {
  if (!user) return false;
  try {
    await set(`prep:${user.id}`, local);
    return true;
  } catch {
    const message =
      "Enregistrement local impossible. Vérifiez l’espace disponible et les autorisations du navigateur.";
    if (strict) throw new Error(message);
    toast(message);
    return false;
  }
}
async function loadLocal() {
  try {
    local = user
      ? ((await get<LocalData>(`prep:${user.id}`)) ?? freshLocal())
      : freshLocal();
  } catch {
    local = freshLocal();
    toast(
      "Le stockage local est inaccessible. Vos entretiens restent disponibles sur votre compte.",
    );
  }
}
async function api(path: string, options: RequestInit = {}) {
  let res: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 145000);
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "InterviewPrep",
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "Le délai de réponse est dépassé. Réessayez ; vos réponses enregistrées sont conservées."
        : "Connexion au serveur impossible. Vérifiez votre connexion, puis réessayez.",
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    let message = `La demande a échoué (${res.status}).`;
    try {
      message = (await res.json()).error || message;
    } catch {
      /* empty authentication response */
    }
    if (res.status === 401 && path !== "/auth/login") {
      message =
        "Connectez-vous pour continuer. Votre session a peut-être expiré.";
      user = null;
      payment = null;
      dataLoaded = false;
      ++gateVersion;
      cvs = [];
      sessions = [];
      local = freshLocal();
      pendingRoute = isPublicRoute(route()) ? "home" : route();
      authNext = undefined;
      history.replaceState({ prep: true }, "", "#login");
      renderedHash = location.hash;
      closeModal(true);
      render();
    }
    if (res.status === 402) {
      payment = { is_paid: false, paid_at: null };
      dataLoaded = false;
      cvs = [];
      sessions = [];
      modalBusy = false;
      closeModal(true);
      nav("pricing", true);
    }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}
const post = (path: string, data?: unknown) =>
  api(path, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
async function refreshRecords() {
  const data = await api("/data");
  cvs = data.cvs;
  sessions = data.sessions;
  dataLoaded = true;
}
async function refresh() {
  payment = await checkPaymentStatus();
  if (user) user.is_admin = payment.is_admin === true;
  if (hasAccess(payment)) await refreshRecords();
  else {
    cvs = [];
    sessions = [];
    dataLoaded = false;
  }
}
function needsPayment(r: string) {
  return [
    "cv",
    "practice",
    "history",
    "session",
    "results",
    "interview",
    "analyse",
  ].includes(r.split("/")[0]);
}
function paymentAuthExpired() {
  pendingRoute = route();
  user = null;
  payment = null;
  dataLoaded = false;
  cvs = [];
  sessions = [];
  local = freshLocal();
  modalBusy = false;
  authNext = undefined;
  nav("login", true);
  toast("Votre session a expiré. Connectez-vous pour continuer.");
}
let checkingAction = false;
function requirePaid(next: () => void) {
  requireUser(() => {
    if (checkingAction) return;
    checkingAction = true;
    const id = user?.id;
    void checkPaymentStatus()
      .then(async (status) => {
        if (user?.id !== id) return;
        payment = status;
        if (user) user.is_admin = status.is_admin === true;
        if (!hasAccess(status)) {
          cvs = [];
          sessions = [];
          dataLoaded = false;
          nav("pricing");
          return;
        }
        if (!dataLoaded) await refreshRecords();
        next();
      })
      .catch((error) => {
        if (error instanceof CheckoutError && error.status === 401)
          paymentAuthExpired();
        else
          toast(
            error instanceof Error
              ? error.message
              : "Vérification impossible. Réessayez.",
          );
      })
      .finally(() => {
        checkingAction = false;
      });
  });
}
function requireUser(next: () => void) {
  if (!ready) {
    toast(
      "Votre espace est en cours de chargement. Réessayez dans un instant.",
    );
    return;
  }
  if (user) next();
  else openAuth("register", next);
}
function activeMain() {
  const r = route().split("?")[0];
  return r.startsWith("session")
    ? "practice"
    : r.startsWith("results")
      ? "history"
      : r.split("/")[0];
}
function sidebarLink(path: string, label: string, ico: string, count?: number) {
  return `<a href="#${path}" class="nav-link ${activeMain() === path ? "active" : ""}" ${activeMain() === path ? 'aria-current="page"' : ""}>${ripple}${icon(ico)}${label}${count ? `<span class="count">${count}</span>` : ""}</a>`;
}
function shell(content: string) {
  const titles: Record<string, string> = {
    admin: "Administration",
    tickets: "Mes demandes",
    support: "Support",
    contact: "Contact",
    about: "À propos",
    legal: "Mentions légales",
    privacy: "Confidentialité",
    terms: "Conditions",
    home: "Mon espace",
    cv: "Mon CV",
    practice: "Mon entraînement",
    history: "Mes entretiens",
    saved: "Mes favoris",
    settings: "Paramètres",
    search: "Recherche",
    pricing: "Activer mon accès",
    merci: "Confirmation du paiement",
  };
  const active = activeMain();
  return `<div class="shell"><div class="mobile-scrim" data-act="menu-close"></div><aside class="sidebar" aria-label="Navigation principale">${wordmark("#home", "workspace-wordmark")}<div class="nav-caption">VOTRE ESPACE</div><nav>${sidebarLink("home", "Tableau de bord", "home")}${sidebarLink("cv", "Mon CV", "description", cvs.length)}${sidebarLink("practice", "M’entraîner", "forum")}${sidebarLink("history", "Mes entretiens", "history", sessions.length)}${sidebarLink("saved", "Mes favoris", "favorite")}${sidebarLink("tickets", "Mes demandes", "forum")}${user?.is_admin ? sidebarLink("admin", "Administration", "settings") : ""}${!hasAccess(payment) ? sidebarLink("pricing", "Activer mon accès", "credit_card") : ""}</nav><div class="sidebar-bottom"><div class="side-note"><p>Votre prochain entretien</p><small>Choisissez un poste et préparez vos réponses.</small>${btn("Commencer", "start", "arrow_forward", "text")}</div>${sidebarLink("settings", "Paramètres", "settings")}<button class="nav-link" style="border:0;background:none;width:100%" data-act="help">${ripple}${icon("help")}Aide</button></div></aside><div class="main-wrap"><header class="appbar">${ib("menu", "Ouvrir le menu", "menu", 'class="mobile-menu"')}${wordmark("#home", "mobile-title")}<div class="breadcrumb">${icon("grid_view")}<span>Votre préparation</span>${icon("chevron_right")}<strong>${titles[active] ?? "Mon espace"}</strong></div><div class="top-actions">${ib("help", "Comment ça marche ?", "help", 'class="help-btn"')}<span class="divider"></span>${user ? `<span class="top-name">${esc(user.name)}</span><button class="avatar" data-act="profile" aria-label="Mon profil">${ripple}${esc(user.name.slice(0, 2).toUpperCase())}</button>` : btn("Se connecter", "login", "", "text")}${ib("more_vert", "Plus d’options", "more")}</div></header><main class="page ${backward ? "back" : ""}" id="main-content">${content}<footer class="footer"><a href="#welcome">Interview Prep AI ${icon("north_east")}</a><a href="#support">Support</a><a href="#contact">Contact</a><a href="#legal">Mentions légales</a><a href="#privacy">Confidentialité</a><a href="#terms">Conditions</a></footer></main></div><nav class="bottom-nav" aria-label="Navigation mobile">${[
    ["home", "Accueil", "home"],
    ["search", "Recherche", "search"],
    ["saved", "Favoris", "favorite"],
    ["settings", "Réglages", "settings"],
    ...(!hasAccess(payment) ? [["pricing", "Accès", "credit_card"]] : []),
  ]
    .map(
      ([path, label, ico]) =>
        `<a href="#${path}" class="${active === path ? "active" : ""}" ${active === path ? 'aria-current="page"' : ""}>${ripple}<span class="nav-icon">${icon(ico)}</span><span>${label}</span></a>`,
    )
    .join(
      "",
    )}</nav>${!route().startsWith("session/") && !isHubRoute(route()) ? `<div class="fab-wrap"><div class="fab-items" hidden>${btn("Importer un CV", "upload", "upload_file", "filled-tonal")}${btn("Écrire une note", "new-note", "edit", "filled-tonal")}</div><md-fab aria-label="Créer ou importer" aria-expanded="false" data-act="fab">${mi("add")}</md-fab></div>` : ""}</div>`;
}
function pageTitle(
  eyebrow: string,
  title: string,
  subtitle: string,
  action = "",
) {
  return `<div class="page-title"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function empty(kind: string, title: string, body: string, button = "") {
  return `<div class="empty"><div class="empty-art">${art(kind)}</div><h2>${title}</h2><p>${body}</p>${button}</div>`;
}
function home() {
  const done = sessions.filter((s) => s.result),
    ongoing = sessions.find((s) => !s.result);
  const steps = [cvs.length > 0, sessions.length > 0, done.length > 0];
  return `${!hasAccess(payment) ? `<aside class="access-banner"><p>L’analyse des CV et les entretiens nécessitent un accès actif. ${payment === null ? "Son état n’a pas pu être vérifié." : "Votre accès n’est pas encore activé."}</p><div>${btn("Voir le tarif", "go-pricing", "", "filled-tonal")}${btn("J’ai déjà payé", "go-merci", "", "text")}</div></aside>` : ""}<section class="welcome"><div><h1>Bonjour, ${esc(user?.name.split(" ")[0])}.</h1><p>Retrouvez vos CV, vos entretiens et vos bilans.</p></div><md-outlined-text-field id="home-search" type="search" label="Rechercher">${mi("search").replace('slot="icon"', 'slot="leading-icon"')}${ib("arrow_forward", "Lancer la recherche", "home-search", 'slot="trailing-icon"')}</md-outlined-text-field></section><section class="hero"><div class="hero-copy"><div class="eyebrow">VOTRE PROCHAIN ENTRETIEN</div><h2>Votre expérience.<br><em>Les mots pour la défendre.</em></h2><p>Préparez vos réponses à partir de votre CV.<br>Choisissez un poste, répondez aux questions<br class="desktop-break"> et identifiez les points à travailler.</p><div>${btn(ongoing ? "Reprendre mon entretien" : cvs.length ? "Préparer un entretien" : "Importer mon CV", ongoing ? "resume" : cvs.length ? "start" : "upload", ongoing ? "play_arrow" : cvs.length ? "arrow_forward" : "upload_file")}<span class="hero-note">${icon("pace")}Sans chronomètre</span></div></div><div class="hero-art">${heroArt()}</div></section><div class="workspace"><section><div class="section-heading"><h2>Votre préparation</h2></div><div class="quick-grid">${[
    [
      "01",
      "Mes CV",
      cvs.length
        ? `${cvs.length} document${cvs.length > 1 ? "s" : ""} analysé${cvs.length > 1 ? "s" : ""}`
        : "Importer et consulter un CV",
      "cv",
      "go-cv",
    ],
    [
      "02",
      "M’entraîner",
      ongoing ? "Une session à reprendre" : "Configurer un nouvel entretien",
      "practice",
      "go-practice",
    ],
    [
      "03",
      "Mes bilans",
      done.length
        ? `${done.length} bilan${done.length > 1 ? "s" : ""} disponible${done.length > 1 ? "s" : ""}`
        : "Consulter mes résultats",
      "results",
      "go-history",
    ],
    [
      "04",
      "Mes notes",
      local.notes.length
        ? `${local.notes.length} note${local.notes.length > 1 ? "s" : ""} enregistrée${local.notes.length > 1 ? "s" : ""}`
        : "Noter mes exemples et mes idées",
      "notes",
      "go-notes",
    ],
  ]
    .map(
      ([n, title, desc, kind, act]) =>
        `<button class="quick-card" data-act="${act}">${ripple}<span class="step">${n}</span><span class="card-art">${art(kind)}</span><h3>${title}</h3><p>${desc}</p><span class="card-arrow icon" aria-hidden="true">arrow_outward</span></button>`,
    )
    .join(
      "",
    )}</div></section><aside><div class="section-heading"><h2>Les étapes de votre préparation</h2></div><div class="journey"><div class="journey-head"><h3>Votre progression</h3><span class="badge">${steps.filter(Boolean).length} / 3</span></div><div class="journey-steps">${[
    ["Importer un CV", "Ajoutez le document qui servira à l’entretien.", "cv"],
    [
      "Préparer un entretien",
      "Choisissez le poste et répondez aux questions.",
      "practice",
    ],
    [
      "Consulter le bilan",
      "Identifiez les réponses à retravailler.",
      "history",
    ],
  ]
    .map(
      ([t, d, path], i) =>
        `<a href="#${path}" class="journey-step"><span class="step-circle ${steps[i] ? "done" : steps.slice(0, i).every(Boolean) ? "current" : ""}">${steps[i] ? icon("check") : i + 1}</span><div><strong>${t}</strong><p>${d}</p></div>${icon("chevron_right")}</a>`,
    )
    .join(
      "",
    )}</div></div><div class="gentle-tip">${icon("lightbulb")}<div><strong>Préparez vos exemples</strong><p>Notez trois réalisations dont vous pouvez expliquer le contexte, votre contribution et le résultat.</p></div></div></aside></div><section class="recent"><div class="section-heading"><h2>Derniers entretiens</h2>${btn("Tout voir", "go-history", "arrow_forward", "text")}</div>${sessions.length ? `<div class="list">${sessions.slice(0, 2).map(sessionRow).join("")}</div>` : `<div class="recent-empty">${icon("history")}<div><h3>Aucun entretien pour le moment</h3><p>Vos sessions apparaîtront ici après leur création.</p></div>${btn("Créer un entretien", "start", "arrow_forward", "text")}</div>`}</section>`;
}
function sessionRow(s: Session) {
  return `<div class="list-row"><span class="lead">${icon(s.result ? "task_alt" : "forum")}</span><button class="row-link" data-act="open-session" data-id="${s.id}"><h3>${esc(s.role)}</h3><p>${date(s.createdAt)} · ${s.questions.length} questions · ${s.result ? "Terminé" : "À reprendre"}</p></button>${s.result ? `<span class="score-mini">${s.result.score}<small>/100</small></span>` : `<span class="badge">En cours</span>`}${ib("chevron_right", "Ouvrir cet entretien", "open-session", `data-id="${s.id}"`)}${!s.result ? ib("delete", "Supprimer cet entretien", "delete-session", `data-id="${s.id}"`) : ""}</div>`;
}
function cvPage() {
  const id = route().split("/")[1],
    cv = cvs.find((c) => c.id === id);
  if (cv)
    return `${pageTitle("VOTRE PARCOURS", esc(cv.analysis.role), "Synthèse du document et recommandations.", btn("M’entraîner", "start", "forum"))}<div class="two-col"><section class="panel"><div class="file-preview" style="margin:0 0 22px">${icon("description")}<div class="grow"><div class="file-name">${esc(cv.name)}</div><small>Analysé le ${date(cv.createdAt)}</small></div>${ib("delete", "Supprimer ce CV", "delete-cv", `data-id="${cv.id}"`)}</div><h2>Synthèse du parcours</h2><p class="cv-summary">${esc(cv.analysis.summary)}</p><h3 class="section-space">Vos compétences</h3><div class="chips">${cv.analysis.skills.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div></section><section class="panel"><div class="eyebrow">${icon("lightbulb")} UN PEU PLUS LOIN</div><h2 style="margin-top:12px">Recommandations pour le CV</h2><ol class="tip-list">${cv.analysis.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ol><p style="margin-top:18px;font-size:10px">Vérifiez cette synthèse automatique avant de vous appuyer sur ses informations.</p></section></div><div class="section-space">${btn("Tous mes CV", "go-cv", "arrow_back", "text")}</div>`;
  return `${pageTitle("LE POINT DE DÉPART", "Mes CV", "Ajoutez un CV pour obtenir une analyse et préparer vos entretiens.", cvs.length ? btn("Importer", "upload", "add") : "")}<div class="two-col"><section>${cvs.length ? `<div class="list">${cvs.map((c) => `<div class="list-row"><span class="lead">${icon("description")}</span><button class="row-link" data-act="open-cv" data-id="${c.id}"><h3>${esc(c.name)}</h3><p>${esc(c.analysis.role)} · ${date(c.createdAt)}</p></button>${ib("chevron_right", "Voir l’analyse", "open-cv", `data-id="${c.id}"`)}</div>`).join("")}</div>` : empty("cv", "Aucun CV importé", "Importez un document PDF pour préparer des questions liées à vos expériences.", btn("Importer mon CV", "upload", "upload_file"))}</section><aside class="stack"><div class="panel"><h2>Le document à importer</h2><p>Utilisez une version à jour de votre CV. Les expériences et compétences qui y figurent serviront à préparer les questions.</p><ol class="tip-list"><li>Un PDF lisible de 8 Mo maximum.</li><li>Une synthèse de votre parcours et des pistes d’amélioration.</li><li>Des entretiens adaptés au poste que vous visez.</li></ol></div><div class="privacy-box">${icon("shield")}<span>Votre accord sera demandé avant l’analyse. Retirez les coordonnées ou informations sensibles qui ne sont pas utiles à votre préparation.</span></div></aside></div>`;
}
function practicePage() {
  const ongoing = sessions.filter((s) => !s.result);
  return `${pageTitle("PRÉPARATION", "Préparer un entretien", "Choisissez un poste et entraînez-vous sur des questions liées à votre parcours.")}<div class="two-col"><section class="panel practice-card"><div class="practice-visual">${art("practice")}</div><div class="practice-card-copy"><h2>Un entretien à partir de votre CV</h2><p>Répondez par écrit à 5 ou 8 questions. À la fin, consultez votre bilan et les réponses à retravailler.</p><div class="chips"><span class="chip">${icon("description")} Basé sur votre CV</span><span class="chip">5 ou 8 questions</span><span class="chip">En français</span></div>${btn(cvs.length ? "Configurer mon entretien" : "Importer un CV pour commencer", cvs.length ? "start" : "upload", "arrow_forward", "filled", 'class="full"')}</div></section><aside class="stack"><div class="panel"><h2>Avant de commencer</h2><ol class="tip-list"><li>Prévoyez un exemple concret pour chaque compétence importante.</li><li>Vous pouvez interrompre la session : les brouillons restent sur cet appareil.</li><li>Validez toutes vos réponses pour recevoir le bilan.</li></ol></div>${ongoing.length ? `<section><div class="section-heading"><h2>Entretiens à reprendre</h2></div><div class="list">${ongoing.map(sessionRow).join("")}</div></section>` : ""}<div class="gentle-tip">${icon("lightbulb")}<div><strong>Donnez du contexte à vos réponses</strong><p>Décrivez la situation, votre rôle, vos actions et le résultat. Précisez les chiffres lorsque vous les connaissez.</p></div></div></aside></div>`;
}
function historyPage() {
  let list = sessions.filter(
    (s) =>
      historyFilter === "all" ||
      (historyFilter === "done" ? s.result : !s.result),
  );
  return `${pageTitle("VOTRE PROGRESSION", "Mes entretiens", "Reprenez une session ou consultez le bilan d’un entretien terminé.", btn("Nouvel entretien", "start", "add"))}<div class="tabs" role="tablist" aria-label="Filtrer les entretiens">${[
    ["all", "Tous"],
    ["ongoing", "En cours"],
    ["done", "Terminés"],
  ]
    .map(
      ([v, t]) =>
        `<button role="tab" aria-selected="${historyFilter === v}" class="tab ${historyFilter === v ? "selected" : ""}" data-act="filter" data-value="${v}">${ripple}${t}</button>`,
    )
    .join(
      "",
    )}</div>${list.length ? `<div class="list">${list.map(sessionRow).join("")}</div>` : empty("results", sessions.length ? "Rien dans cette catégorie." : "Aucun entretien enregistré", sessions.length ? "Choisissez un autre filtre pour retrouver vos entretiens." : "Créez votre première session. Elle restera accessible ici, même si vous l’interrompez.", btn("Préparer un entretien", "start", "forum"))}`;
}
function sessionPage(s: Session) {
  if (s.result) {
    queueMicrotask(() => nav(`results/${s.id}`));
    return "";
  }
  if (lastSession !== s.id) {
    lastSession = s.id;
    const answers = local.drafts[s.id] ?? s.answers;
    const firstEmpty = answers.findIndex((a) => a.trim().length < 20);
    currentQuestion = firstEmpty < 0 ? s.questions.length - 1 : firstEmpty;
  }
  const i = Math.min(currentQuestion, s.questions.length - 1),
    q = s.questions[i],
    answer = (local.drafts[s.id] ?? s.answers)[i] ?? "";
  return `<div class="practice-layout"><div class="session-top">${btn("Mes entretiens", "go-history", "arrow_back", "text")}<span>${esc(s.role)}</span><span class="badge">${i + 1} / ${s.questions.length}</span></div><div class="session-progress" aria-label="Question ${i + 1} sur ${s.questions.length}">${s.questions.map((_, j) => `<span class="${j <= i ? "complete" : ""}"></span>`).join("")}</div><div class="interviewer"><span class="avatar">${icon("forum")}</span><div><strong>Entretien de préparation</strong>Répondez en vous appuyant sur votre expérience.</div></div><section class="panel question-card"><div class="eyebrow">QUESTION ${String(i + 1).padStart(2, "0")} · ${esc(q.category)}</div><h2>${esc(q.text)}</h2><details class="question-hint"><summary>Voir une piste de réponse</summary><p>${esc(q.hint)}</p></details></section><md-outlined-text-field class="answer-field" id="answer" type="textarea" rows="8" label="Votre réponse" supporting-text="Appuyez-vous sur un exemple concret de votre parcours." maxlength="6000" value="${esc(answer)}"></md-outlined-text-field><div class="answer-meta"><span id="draft-status">${icon("cloud_done")} Brouillon conservé sur cet appareil</span><span id="answer-count">${answer.length} / 6 000 caractères</span></div><div class="form-error" id="page-error" role="alert"></div><div class="actions-row">${btn("Précédente", "prev-question", "arrow_back", "outlined", i === 0 ? "disabled" : "")}${btn(i === s.questions.length - 1 ? "Découvrir mon bilan" : "Question suivante", i === s.questions.length - 1 ? "evaluate" : "next-question", i === s.questions.length - 1 ? "task_alt" : "arrow_forward")}</div><div class="gentle-tip section-space">${icon("lightbulb")}<div><strong>Un exemple vaut mieux qu’une liste de qualités.</strong><p>Pensez à la méthode STAR : Situation, Tâche, Action, Résultat. Les détails donnent du relief à votre réponse.</p></div></div></div>`;
}
function resultPage(s: Session) {
  const r = s.result;
  if (!r) return sessionPage(s);
  return `${pageTitle("UN NOUVEAU PAS EN AVANT", "Bilan de l’entretien", "Consultez l’évaluation de vos réponses et les points à retravailler.", btn("Recommencer", "start", "refresh"))}<div class="result-hero"><div class="score-ring" style="--score:${r.score}"><div>${r.score}<small>sur 100</small></div></div><div><div class="eyebrow">VOTRE REPÈRE D’ENTRAÎNEMENT</div><h2>${esc(s.role)}</h2><p>${esc(r.summary)}</p><small>${date(s.completedAt ?? s.createdAt)} · ${s.questions.length} questions</small></div></div><div class="two-col"><section class="panel"><h2>Points forts</h2><ul class="tip-list">${r.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h2 class="section-space">Points à améliorer</h2><ol class="tip-list">${r.improvements.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></section><section class="panel"><h2>Votre bilan, en détail</h2>${r.criteria.map((c) => `<div class="criterion"><div class="actions-row"><span>${esc(c.name)}</span><span>${c.score}/100</span></div><div class="meter"><span style="width:${c.score}%"></span></div><p>${esc(c.comment)}</p></div>`).join("")}</section></div><section class="panel section-space"><h2>Détail des réponses</h2>${s.questions.map((q, i) => `<details class="feedback"><summary><span class="badge">${i + 1}</span><span>${esc(q.text)}</span>${icon("expand_more")}</summary><p><strong>Votre réponse</strong><br>${esc(s.answers[i])}</p><p>${esc(r.feedback[i]?.comment)}</p><div class="example"><small>UNE PISTE DE RÉPONSE À ADAPTER</small><p>${esc(r.feedback[i]?.example)}</p></div>${btn(local.favorites.includes(`${s.id}:${i}`) ? "Retirer des favoris" : "Garder cette question", "favorite", local.favorites.includes(`${s.id}:${i}`) ? "favorite" : "favorite_border", "text", `data-id="${s.id}:${i}"`)}</details>`).join("")}</section><div class="actions-row section-space">${btn("Exporter mon bilan", "export-result", "download", "outlined", `data-id="${s.id}"`)}${btn("Supprimer cet entretien", "delete-session", "delete", "text", `data-id="${s.id}" class="danger"`)}</div><div class="privacy-box section-space">${icon("info")}<span>Ce bilan est généré par une IA et peut contenir des erreurs. Le score est la moyenne de trois critères ; il sert à s’entraîner et ne prédit pas une décision d’embauche.</span></div>`;
}
function savedPage() {
  const favorites = local.favorites
    .map((k) => {
      const [id, index] = k.split(":");
      return { key: k, s: sessions.find((s) => s.id === id), i: Number(index) };
    })
    .filter((x) => x.s?.questions[x.i]);
  return `${pageTitle("LES IDÉES QUI RESTENT", "Notes et favoris", "Vos notes personnelles et les questions à retravailler.", btn("Nouvelle note", "new-note", "add"))}<div class="tabs" role="tablist" aria-label="Type de favoris"><button class="tab ${savedTab === "notes" ? "selected" : ""}" role="tab" aria-selected="${savedTab === "notes"}" data-act="saved-tab" data-value="notes">${ripple}Mes notes <span class="muted">${local.notes.length}</span></button><button class="tab ${savedTab === "questions" ? "selected" : ""}" role="tab" aria-selected="${savedTab === "questions"}" data-act="saved-tab" data-value="questions">${ripple}Questions <span class="muted">${favorites.length}</span></button></div>${savedTab === "notes" ? (local.notes.length ? `<div class="notes-grid">${local.notes.map(noteCard).join("")}</div>` : empty("notes", "Aucune note enregistrée", "Notez vos exemples de réalisations et les questions à poser au recruteur.", btn("Écrire ma première note", "new-note", "edit"))) : favorites.length ? `<div class="stack">${favorites.map(({ key, s, i }) => `<div class="panel"><div class="eyebrow">${esc(s!.role)}</div><h3 style="margin:14px 0">${esc(s!.questions[i].text)}</h3><p>${esc(s!.result?.feedback[i]?.comment ?? s!.questions[i].hint)}</p><div class="actions-row section-space">${btn("Voir mon bilan", "open-session", "arrow_forward", "text", `data-id="${s!.id}"`)}${ib("favorite", "Retirer des favoris", "favorite", `data-id="${key}" class="filled"`)}</div></div>`).join("")}</div>` : empty("practice", "Aucune question favorite", "À la fin d’un entretien, ajoutez une question aux favoris pour la retrouver et la retravailler.")}<p class="muted section-space" style="font-size:10px">${icon("devices")} Les notes et favoris sont conservés dans ce navigateur, pour votre compte. Exportez-les dans les réglages pour les garder ailleurs.</p>`;
}
function rich(text: string) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/\~(.+?)\~/g, "<u>$1</u>");
}
function noteCard(n: Note) {
  return `<article class="note-card"><h3>${esc(n.title)}</h3><p>${rich(n.body)}</p><div class="actions-row"><small>${date(n.updatedAt)}</small><span>${ib("edit", "Modifier cette note", "edit-note", `data-id="${n.id}"`)}${ib("delete", "Supprimer cette note", "delete-note", `data-id="${n.id}"`)}</span></div></article>`;
}
function settingsPage() {
  return `${pageTitle("VOTRE COMPTE", "Paramètres", "Gérez votre profil, vos préférences et vos données.")}<div class="two-col"><div class="stack"><section class="panel"><h2>Votre profil</h2>${user?.is_admin ? `<p>Administrateur · accès gratuit aux créations.</p><a class="hub-link" href="#admin">Ouvrir l’administration</a>` : ""}${user ? `<div class="list-row" style="padding-left:0"><span class="lead">${icon("person")}</span><div class="grow"><h3>${esc(user.name)}</h3><p>${esc(user.email)}</p></div>${ib("edit", "Modifier mon nom", "edit-profile")}</div><p class="account-id"><small>Identifiant de ce compte</small><br><span>${esc(user.id)}</span></p>${btn("Se déconnecter", "logout", "logout", "text")}` : `<p>Créez votre compte pour retrouver vos CV et entretiens sur vos appareils.</p><div class="section-space">${btn("Créer mon compte", "register", "person_add")}</div>`}</section><section class="panel"><h2>Préférences</h2><div class="settings-row"><div><h3>Confirmations d’enregistrement</h3><p>Afficher un message après l’enregistrement d’une note ou d’un favori.</p></div><md-switch id="notifications" ${local.notifications ? "selected" : ""} aria-label="Confirmations d’enregistrement"></md-switch></div><div class="settings-row"><div><h3>Langue des entretiens</h3><p>Questions et bilans en français.</p></div><span class="badge">Français</span></div></section></div><div class="stack"><section class="panel"><h2>Gestion des données</h2><a class="hub-link" href="#tickets">Mes demandes et export du support</a><p>CV analysés et entretiens sont liés à votre compte sur le serveur. Notes, favoris et brouillons restent sur cet appareil.</p><div class="settings-row"><div><h3>Exporter mes données</h3><p>Exporter vos données dans un fichier JSON.</p></div>${ib("download", "Exporter mes données", "export-all")}</div><div class="settings-row"><div><h3>Effacer les données locales</h3><p>Supprime les notes, favoris et brouillons sur cet appareil.</p></div>${ib("delete_sweep", "Effacer mes données locales", "clear-local")}</div>${user ? `<div class="section-space">${btn("Supprimer mon compte", "delete-account", "delete_forever", "text", 'class="danger"')}</div>` : ""}</section><div class="privacy-box">${icon("shield")}<span>Consultez les modalités de traitement de votre CV, la conservation des données et les options de suppression. ${btn("En savoir plus", "privacy", "", "text")}</span></div></div></div>`;
}
function searchPage() {
  return `${pageTitle("RETROUVER L’ESSENTIEL", "Rechercher dans mon espace", "Un CV, un entretien ou une idée notée en passant.")}<md-outlined-text-field type="search" class="search-large" id="global-search" label="Rechercher dans mes CV, entretiens et notes" value="${esc(search)}">${mi("search").replace('slot="icon"', 'slot="leading-icon"')}</md-outlined-text-field><div id="search-results">${searchResults()}</div>`;
}
function searchResults() {
  if (!search.trim())
    return empty(
      "notes",
      "Rechercher un document ou une note",
      "Saisissez quelques mots pour chercher dans vos contenus.",
    );
  const q = search.trim().toLocaleLowerCase("fr");
  const cs = cvs.filter((c) =>
    (c.name + " " + c.analysis.summary + " " + c.analysis.role)
      .toLocaleLowerCase("fr")
      .includes(q),
  );
  const ss = sessions.filter((s) =>
    (s.role + " " + s.questions.map((q) => q.text).join(" "))
      .toLocaleLowerCase("fr")
      .includes(q),
  );
  const ns = local.notes.filter((n) =>
    (n.title + " " + n.body).toLocaleLowerCase("fr").includes(q),
  );
  if (!cs.length && !ss.length && !ns.length)
    return empty(
      "notes",
      "Pas encore de correspondance.",
      "Essayez un autre mot ou ajoutez votre premier contenu.",
    );
  return `<div class="stack">${cs.length ? `<h2>CV · ${cs.length}</h2><div class="list">${cs.map((c) => `<div class="list-row"><span class="lead">${icon("description")}</span><button class="row-link" data-act="open-cv" data-id="${c.id}"><h3>${esc(c.name)}</h3><p>${esc(c.analysis.role)}</p></button>${ib("chevron_right", "Voir le CV", "open-cv", `data-id="${c.id}"`)}</div>`).join("")}</div>` : ""}${ss.length ? `<h2>Entretiens · ${ss.length}</h2><div class="list">${ss.map(sessionRow).join("")}</div>` : ""}${ns.length ? `<h2>Notes · ${ns.length}</h2><div class="notes-grid">${ns.map(noteCard).join("")}</div>` : ""}</div>`;
}
function render() {
  app.dataset.direction = backward ? "back" : "forward";
  disposePaymentPage();
  disposePaymentPage = () => {};
  const r = route();
  if (r === "welcome" || r.startsWith("welcome/")) {
    app.innerHTML = landing(!!user);
    return;
  }
  if (r === "login" || r === "register") {
    app.innerHTML = authPage(r);
    return;
  }
  if (!ready) {
    app.innerHTML =
      '<main class="initial-loading">' +
      wordmark() +
      '<md-circular-progress indeterminate aria-label="Chargement de votre espace"></md-circular-progress><p>Chargement de votre espace…</p></main>';
    return;
  }
  if (isHubRoute(r)) {
    const content = hubPage();
    app.innerHTML = user
      ? shell(content)
      : `<div class="public-site">${publicHeader(false)}<main class="public-width hub-public" id="main-content">${content}</main>${publicFooter()}</div>`;
    disposePaymentPage = mountHub(
      document.querySelector<HTMLElement>("#hub-root")!,
      r,
      user,
      (page) => nav(page),
      paymentAuthExpired,
    );
    return;
  }
  if (r === "pricing") {
    const content = pricingPage(user, payment);
    app.innerHTML = user
      ? shell(content)
      : `<div class="public-site">${publicHeader(false)}<main class="public-width pricing-public" id="main-content">${content}</main>${publicFooter()}</div>`;
    const root = document.querySelector<HTMLElement>("#pricing-page");
    if (root)
      disposePaymentPage = mountPricing(root, {
        user,
        onAuth: (mode) => {
          pendingRoute = "pricing";
          openAuth(mode);
        },
        onCompleted: async (step) => {
          await refresh();
          nav("home");
          if (step === "completed" && !hasAccess(payment))
            toast(
              "La confirmation est en cours. Retrouvez son état dans la page de confirmation.",
            );
        },
        redirect: (url) => window.location.assign(url),
        onError: () => paymentAuthExpired(),
      });
    return;
  }
  if (!user) {
    app.innerHTML = landing(false);
    return;
  }
  if (gatePending || (needsPayment(r) && gateError)) {
    app.innerHTML = shell(
      gatePending
        ? '<div class="payment-gate" role="status"><md-circular-progress indeterminate aria-label="Vérification de l’accès"></md-circular-progress><h2>Vérification de votre accès…</h2></div>'
        : `<div class="payment-gate"><h2>Accès non vérifié</h2><p role="alert">${esc(gateError)}</p>${btn("Réessayer", "retry-payment", "refresh")}${btn("Retour à mon espace", "go-home", "", "text")}</div>`,
    );
    return;
  }
  if (r === "merci") {
    if (payment?.is_admin && hasAccess(payment)) {
      app.innerHTML = shell(pricingPage(user, payment));
      return;
    }
    app.innerHTML = shell(merciPage(payment));
    disposePaymentPage = mountMerci(
      document.querySelector<HTMLElement>("#merci-page")!,
      payment,
      {
        onConfirmed: (status) => {
          payment = status;
          if (user) user.is_admin = status.is_admin === true;
          void refreshRecords()
            .then(() => {
              if (route() === "merci") render();
            })
            .catch((e) => toast(e.message));
        },
        onAuth: () => paymentAuthExpired(),
      },
    );
    return;
  }
  let content = "";
  if (r === "home") content = home();
  else if (r === "cv" || r.startsWith("cv/")) content = cvPage();
  else if (r === "practice") content = practicePage();
  else if (r === "history") content = historyPage();
  else if (r === "saved") content = savedPage();
  else if (r === "settings") content = settingsPage();
  else if (r === "search") content = searchPage();
  else if (r.startsWith("session/") || r.startsWith("results/")) {
    const s = sessions.find((s) => s.id === r.split("/")[1]);
    content = s
      ? r.startsWith("results/")
        ? resultPage(s)
        : sessionPage(s)
      : ready
        ? empty(
            "practice",
            "Cet entretien n’est pas disponible.",
            user
              ? "Il a peut-être été supprimé. Retrouvez vos autres entretiens dans votre espace."
              : "Connectez-vous au compte utilisé pour cet entretien.",
            btn(
              user ? "Mes entretiens" : "Se connecter",
              user ? "go-history" : "login",
              "arrow_forward",
            ),
          )
        : '<div class="loader"><md-circular-progress indeterminate></md-circular-progress>Retrouvons votre entretien…</div>';
  } else
    content = empty(
      "notes",
      "Page introuvable",
      "Vérifiez l’adresse ou revenez à votre tableau de bord.",
      btn("Retour à l’accueil", "go-home", "home"),
    );
  app.innerHTML = shell(content);
  backward = false;
}
function field(id: string): any {
  return document.getElementById(id);
}
function value(id: string): string {
  return field(id)?.value ?? "";
}
function validFields(ids: string[]) {
  let valid = true;
  for (const id of ids) {
    const el = field(id);
    if (!el) {
      valid = false;
      continue;
    }
    const v = String(el.value ?? "");
    let message = "";
    const min = Number(el.getAttribute("minlength") ?? 0),
      max = Number(el.getAttribute("maxlength") ?? Infinity);
    if (el.hasAttribute("required") && !v.trim())
      message = "Ce champ est obligatoire.";
    else if (v.length < min) message = `Saisissez au moins ${min} caractères.`;
    else if (v.length > max)
      message = `Saisissez au maximum ${max} caractères.`;
    else if (
      el.getAttribute("type") === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    )
      message = "Saisissez une adresse e-mail valide.";
    el.setCustomValidity?.(message);
    if (!el.reportValidity() || message) valid = false;
  }
  return valid;
}
let authNext: (() => void) | undefined;
function modal(title: string, body: string, actions = "") {
  closeModal(true);
  modalRoot.innerHTML = `<md-dialog aria-label="${esc(title)}"><div slot="headline">${title}</div><div slot="content">${body}<div class="form-error" id="modal-error" role="alert"></div></div><div slot="actions">${actions || btn("Fermer", "close", "", "text")}</div></md-dialog>`;
  const dialog = modalRoot.querySelector("md-dialog") as any;
  dialog.addEventListener("cancel", (e: Event) => {
    if (modalBusy) e.preventDefault();
  });
  dialog.quick = matchMedia("(prefers-reduced-motion: reduce)").matches;
  dialog.show();
}
function closeModal(force = false) {
  if (modalBusy && !force) return;
  const d = modalRoot.querySelector("md-dialog") as any;
  d?.close();
  modalRoot.replaceChildren();
}
async function working(el: HTMLElement, fn: () => Promise<void>, page = false) {
  if (modalBusy) return;
  modalBusy = true;
  const error = document.getElementById(
    el.closest(".auth-card")
      ? "auth-error"
      : page
        ? "page-error"
        : "modal-error",
  );
  if (error) error.textContent = "";
  const original = el.innerHTML;
  el.setAttribute("disabled", "");
  const loadingLabels: Record<string, string> = {
    analyze: "Analyse du CV…",
    "create-session": "Préparation des questions…",
    evaluate: "Évaluation des réponses…",
    "submit-login": "Connexion…",
    "submit-register": "Création du compte…",
  };
  el.innerHTML = `<md-circular-progress slot="icon" indeterminate style="--md-circular-progress-size:20px" aria-label="Chargement"></md-circular-progress>${loadingLabels[el.dataset.act ?? ""] ?? "Enregistrement…"}`;
  try {
    await fn();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Une erreur est survenue.";
    if (error?.isConnected) error.textContent = message;
    else toast(message);
  } finally {
    modalBusy = false;
    if (el.isConnected) {
      el.removeAttribute("disabled");
      el.innerHTML = original;
    }
  }
}
function forceClose() {
  modalBusy = false;
  closeModal();
}
function openAuth(mode: "register" | "login", next?: () => void) {
  authNext = next ?? authNext;
  nav(mode);
}
function openUpload() {
  requirePaid(() => {
    selectedFile = null;
    modal(
      "Importer un CV",
      `<p class="modal-intro">Ajoutez votre document PDF pour obtenir une synthèse et préparer les questions.</p><input id="pdf-input" type="file" accept="application/pdf,.pdf" hidden><div class="drop-zone" data-act="pick-pdf" tabindex="0" role="button" aria-label="Choisir un CV au format PDF">${icon("upload_file")}<h3>Glissez votre CV ici</h3><p>ou cliquez pour choisir un fichier</p><p>PDF uniquement · 8 Mo maximum</p></div><div id="file-preview"></div><label class="consent"><md-checkbox id="pdf-consent" aria-label="Consentir à l’analyse du CV par Google Gemini"></md-checkbox><span>J’accepte que mon CV soit transmis à Google Gemini pour l’analyse. J’ai retiré les informations sensibles inutiles. Le fichier original n’est pas conservé sur le serveur.</span></label><div class="privacy-box">${icon("lock")}<span>Seule l’analyse est enregistrée dans votre compte. Le PDF original n’est pas conservé sur notre serveur.</span></div>`,
      `${btn("Annuler", "close", "", "text")}${btn("Analyser mon CV", "analyze", "arrow_forward")}`,
    );
  });
}
function chooseFile(file?: File) {
  const error = field("modal-error");
  if (!file) return;
  selectedFile = null;
  if (
    file.size > 8 * 1024 * 1024 ||
    file.size < 5 ||
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    error.textContent = "Choisissez un fichier PDF valide de moins de 8 Mo.";
    field("file-preview").innerHTML = "";
    return;
  }
  selectedFile = file;
  error.textContent = "";
  field("file-preview").innerHTML =
    `<div class="file-preview">${icon("description")}<div><div class="file-name">${esc(file.name)}</div><small>${(file.size / 1024).toFixed(0)} Ko · Prêt à être analysé</small></div></div>`;
}
function openStart() {
  requirePaid(() => {
    if (!cvs.length) {
      modal(
        "Un CV est nécessaire",
        `<div class="empty-art" style="margin:auto">${art("cv")}</div><p class="modal-intro">Importez un CV avant de créer l’entretien. Les questions seront préparées à partir de son analyse.</p>`,
        `${btn("Plus tard", "close", "", "text")}${btn("Importer mon CV", "upload", "upload_file")}`,
      );
      return;
    }
    const current = cvs.find((c) => c.id === route().split("/")[1]) ?? cvs[0];
    modal(
      "Configurer l’entretien",
      `<p class="modal-intro">Choisissez le CV, le poste et le niveau à utiliser pour cette session.</p><div class="form-stack"><md-outlined-select id="start-cv" label="Le CV à utiliser" required>${cvs.map((c) => `<md-select-option value="${c.id}" ${c.id === current.id ? "selected" : ""}><div slot="headline">${esc(c.name)}</div></md-select-option>`).join("")}</md-outlined-select><md-outlined-text-field id="start-role" label="Le poste que vous visez" required minlength="2" maxlength="120" value="${esc(current.analysis.role)}"></md-outlined-text-field><md-outlined-select id="start-level" label="Votre niveau" required>${["Débutant", "Intermédiaire", "Confirmé"].map((l, i) => `<md-select-option value="${l}" ${i === 0 ? "selected" : ""}><div slot="headline">${l}</div></md-select-option>`).join("")}</md-outlined-select><md-outlined-select id="start-count" label="La longueur de l’entretien"><md-select-option value="5" selected><div slot="headline">5 questions</div></md-select-option><md-select-option value="8"><div slot="headline">8 questions · Points à améliorer</div></md-select-option></md-outlined-select><p class="note-hint">Les questions s’appuient sur votre CV. Vos réponses seront analysées pour établir le bilan, selon les modalités acceptées lors de l’import.</p></div>`,
      `${btn("Annuler", "close", "", "text")}${btn("Créer l’entretien", "create-session", "arrow_forward")}`,
    );
  });
}
function openNote(id?: string) {
  requireUser(() => {
    const n = local.notes.find((n) => n.id === id);
    modal(
      n ? "Modifier la note" : "Nouvelle note",
      `<p class="modal-intro">Conservez un exemple ou une information à utiliser en entretien.</p><div class="form-stack"><md-outlined-text-field id="note-title" label="Titre" required maxlength="100" value="${esc(n?.title)}"></md-outlined-text-field><md-outlined-text-field id="note-body" type="textarea" rows="7" label="Votre note" required maxlength="10000" value="${esc(n?.body)}"></md-outlined-text-field><div class="toolbar" role="toolbar" aria-label="Mettre en forme la note">${ib("format_bold", "Gras", "format", `data-format="**"`)}${ib("format_italic", "Italique", "format", `data-format="_"`)}${ib("format_underlined", "Souligné", "format", `data-format="~"`)}${ib("attach_file", "Insérer le nom du dernier CV", "attach-cv")}</div><p class="note-hint">Sélectionnez du texte pour le mettre en forme. La note reste sur cet appareil.</p></div>`,
      `${btn("Annuler", "close", "", "text")}${btn("Enregistrer la note", "save-note", "check", "filled", `data-id="${n?.id ?? ""}"`)}`,
    );
  });
}
function openHelp() {
  modal(
    "Utiliser Interview Prep AI",
    `<p class="modal-intro">Préparez un entretien à partir de votre CV, puis consultez le bilan de vos réponses.</p><div class="stack">${[
      [
        "description",
        "01 · Ajoutez votre CV",
        "Importez votre document et consultez son analyse.",
      ],
      [
        "forum",
        "02 · Répondez aux questions",
        "Choisissez un poste et répondez à 5 ou 8 questions personnalisées.",
      ],
      [
        "psychiatry",
        "03 · Consultez votre bilan",
        "Découvrez un score indicatif, vos points forts et des conseils pour progresser.",
      ],
    ]
      .map(
        ([i, t, d]) =>
          `<div class="list-row"><span class="lead">${icon(i)}</span><div><h3>${t}</h3><p>${d}</p></div></div>`,
      )
      .join(
        "",
      )}</div><p class="note-hint section-space">L’entretien se fait par écrit. Vous pouvez quitter la page et reprendre plus tard ; les brouillons sont conservés dans ce navigateur.</p>`,
  );
}
function openPrivacy() {
  modal(
    "Confidentialité et traitement des données",
    `<div class="stack"><p class="modal-intro" style="margin:0">Les données sont utilisées pour gérer votre compte et préparer vos entretiens.</p><div><h3>Votre CV et vos réponses</h3><p class="modal-intro">Avec votre accord, le PDF est envoyé à l’API Google Gemini. L’analyse, les questions, vos réponses validées et les bilans sont conservés sur le serveur, dans votre compte. Le PDF original n’est pas conservé.</p></div><div><h3>Votre compte et votre paiement</h3><p class="modal-intro">Vos données de compte et de préparation sont conservées dans une base PostgreSQL hébergée sur Supabase. Si vous initiez un paiement, votre nom, votre e-mail, votre téléphone et l’identifiant de votre compte sont transmis à Chariow. Les données de carte sont saisies uniquement chez le prestataire. Nous conservons une référence de vente et une date d’activation, jamais vos coordonnées de carte. Après suppression du compte, la référence de vente désassociée est conservée pour empêcher la réutilisation du paiement.</p></div><div><h3>Dans ce navigateur</h3><p class="modal-intro">Vos notes, favoris, préférences et brouillons sont stockés localement via IndexedDB, par compte. Vous pouvez les exporter ou les effacer dans les réglages.</p></div><div><h3>Google Gemini</h3><p class="modal-intro">Le traitement dépend des conditions et du niveau de service du compte Google utilisé par l’administrateur. Retirez les coordonnées et données sensibles inutiles. <a class="inline-link" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Lire les conditions de Google Gemini</a>.</p></div><div><h3>Messagerie de support</h3><p class="modal-intro">Vos demandes et les réponses sont enregistrées en base et accessibles à votre compte et à l’administrateur. Aucun e-mail de notification n’est envoyé. La suppression du compte supprime aussi ses demandes.</p></div><div><h3>Vous gardez la main</h3><p class="modal-intro">Supprimez vos CV et entretiens individuellement, ou votre compte et ses données dans les réglages. Les bilans IA peuvent être inexacts et ne prédisent pas vos chances d’embauche.</p></div></div>`,
  );
}
let confirmFn: (() => Promise<void>) | null = null;
function confirmAction(
  title: string,
  text: string,
  fn: () => Promise<void>,
  label = "Supprimer",
) {
  confirmFn = fn;
  modal(
    title,
    `<p class="modal-intro">${text}</p>`,
    `${btn("Annuler", "close", "", "text")}${btn(label, "confirm", "delete", "filled")}`,
  );
}
function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function currentSession() {
  return sessions.find((s) => s.id === route().split("/")[1]);
}
async function saveAnswers(s: Session) {
  const values = [...(local.drafts[s.id] ?? s.answers)];
  if (field("answer")) values[currentQuestion] = value("answer");
  local.drafts[s.id] = values;
  const updated = await api(`/sessions/${s.id}/answers`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
  sessions = sessions.map((x) => (x.id === s.id ? updated : x));
  return updated as Session;
}
async function action(act: string, el: HTMLElement) {
  const id = el.dataset.id ?? "";
  switch (act) {
    case "public-menu": {
      const menu = document.querySelector(".marketing-nav");
      const opened = menu?.classList.toggle("open") ?? false;
      el.setAttribute("aria-expanded", String(opened));
      el.setAttribute(
        "aria-label",
        opened ? "Fermer la navigation" : "Ouvrir la navigation",
      );
      el.innerHTML = icon(opened ? "close" : "menu");
      break;
    }
    case "home-search":
      search = value("home-search");
      nav("search");
      break;
    case "go-pricing":
      nav("pricing");
      break;
    case "go-merci":
      nav("merci");
      break;
    case "go-home":
      nav("home");
      break;
    case "go-cv":
      nav("cv");
      break;
    case "go-practice":
      nav("practice");
      break;
    case "go-history":
      nav("history");
      break;
    case "go-notes":
      savedTab = "notes";
      nav("saved");
      break;
    case "menu":
      document.querySelector(".sidebar")?.classList.add("open");
      document.querySelector(".mobile-scrim")?.classList.add("open");
      break;
    case "menu-close":
      document.querySelector(".sidebar")?.classList.remove("open");
      document.querySelector(".mobile-scrim")?.classList.remove("open");
      break;
    case "fab": {
      const list = document.querySelector(".fab-items")!;
      const opened = list.hasAttribute("hidden");
      list.toggleAttribute("hidden", !opened);
      el.setAttribute("aria-expanded", String(opened));
      el.setAttribute(
        "aria-label",
        opened ? "Fermer le menu de création" : "Créer ou importer",
      );
      el.innerHTML = mi(opened ? "close" : "add");
      break;
    }
    case "login":
      authNext = undefined;
      openAuth("login");
      break;
    case "register":
      authNext = undefined;
      openAuth("register");
      break;
    case "auth-login":
      openAuth("login");
      break;
    case "auth-register":
      openAuth("register");
      break;
    case "toggle-password": {
      const f = field("auth-password");
      f.type = f.type === "password" ? "text" : "password";
      el.innerHTML = icon(
        f.type === "password" ? "visibility" : "visibility_off",
      );
      el.setAttribute(
        "aria-label",
        f.type === "password"
          ? "Afficher le mot de passe"
          : "Masquer le mot de passe",
      );
      break;
    }
    case "submit-register":
    case "submit-login": {
      const reg = act === "submit-register";
      if (
        !validFields(
          reg
            ? ["auth-name", "auth-email", "auth-password"]
            : ["auth-email", "auth-password"],
        )
      )
        return;
      await working(el, async () => {
        user = await post(`/auth/${reg ? "register" : "login"}`, {
          name: value("auth-name"),
          email: value("auth-email"),
          password: value("auth-password"),
        });
        await loadLocal();
        await refresh();
        forceClose();
        const next = authNext;
        authNext = undefined;
        const destination = pendingRoute;
        pendingRoute = "home";
        nav(destination);
        next?.();
        toast(reg ? "Votre compte a été créé." : "Connexion réussie.");
      });
      break;
    }
    case "close":
      closeModal();
      break;
    case "help":
      nav("support");
      break;
    case "retry-payment":
      void applyRoute();
      break;
    case "privacy":
      if (route() === "login" || route() === "register") openPrivacy();
      else nav("privacy");
      break;
    case "profile":
      nav("settings");
      break;
    case "more":
      modal(
        "Options",
        `<div class="stack">${btn("Comment ça marche ?", "help", "help", "filled-tonal")}${btn("Données et confidentialité", "privacy", "shield", "filled-tonal")}${btn("Mes réglages", "settings", "settings", "filled-tonal")}${user ? btn("Se déconnecter", "logout", "logout", "text") : btn("Créer mon compte", "register", "person_add", "text")}</div>`,
      );
      break;
    case "settings":
      closeModal();
      nav("settings");
      break;
    case "upload":
      openUpload();
      break;
    case "pick-pdf":
      field("pdf-input")?.click();
      break;
    case "analyze":
      if (!selectedFile) {
        field("modal-error").textContent = "Choisissez votre CV au format PDF.";
        return;
      }
      if (!field("pdf-consent").checked) {
        field("modal-error").textContent =
          "Votre accord est nécessaire avant de transmettre le CV à Google.";
        return;
      }
      await working(el, async () => {
        const form = new FormData();
        form.append("file", selectedFile!);
        form.append("consent", "true");
        const cv = await api("/cvs", { method: "POST", body: form });
        cvs.unshift(cv);
        forceClose();
        nav(`cv/${cv.id}`);
        toast("Analyse du CV terminée.");
      });
      break;
    case "open-cv":
      nav(`cv/${id}`);
      break;
    case "delete-cv":
      confirmAction(
        "Supprimer ce CV ?",
        "Son analyse sera supprimée du serveur. Vos entretiens existants seront conservés ; vous pourrez les supprimer séparément.",
        async () => {
          await api(`/records/${id}`, { method: "DELETE" });
          cvs = cvs.filter((c) => c.id !== id);
          forceClose();
          nav("cv");
          toast("Le CV et son analyse ont été supprimés.");
        },
      );
      break;
    case "start":
      openStart();
      break;
    case "create-session":
      if (!validFields(["start-role", "start-cv", "start-level"])) return;
      await working(el, async () => {
        const session = await post("/sessions", {
          cvId: value("start-cv"),
          role: value("start-role"),
          level: value("start-level"),
          count: Number(value("start-count")),
        });
        sessions.unshift(session);
        lastSession = "";
        forceClose();
        nav(`session/${session.id}`);
      });
      break;
    case "resume": {
      const s = sessions.find((s) => !s.result);
      if (s) nav(`session/${s.id}`);
      else openStart();
      break;
    }
    case "open-session": {
      const s = sessions.find((s) => s.id === id);
      if (s) {
        lastSession = "";
        nav(`${s.result ? "results" : "session"}/${id}`);
      }
      break;
    }
    case "filter":
      historyFilter = el.dataset.value ?? "all";
      render();
      break;
    case "prev-question":
      currentQuestion = Math.max(0, currentQuestion - 1);
      backward = true;
      render();
      break;
    case "next-question": {
      const s = currentSession();
      if (!s) return;
      const answer = value("answer").trim();
      if (answer.length < 20) {
        field("page-error").textContent =
          "Développez un peu votre réponse : au moins 20 caractères pour vous donner un retour utile.";
        return;
      }
      await working(
        el,
        async () => {
          await saveAnswers(s);
          currentQuestion++;
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        true,
      );
      break;
    }
    case "evaluate": {
      const s = currentSession();
      if (!s) return;
      await working(
        el,
        async () => {
          const answers = local.drafts[s.id] ?? s.answers;
          if (answers.some((a) => a.trim().length < 20))
            throw new Error(
              "Chaque question nécessite une réponse d’au moins 20 caractères. Revenez aux questions précédentes pour compléter.",
            );
          await saveAnswers(s);
          const updated = await post(`/sessions/${s.id}/evaluate`);
          sessions = sessions.map((x) => (x.id === s.id ? updated : x));
          delete local.drafts[s.id];
          await persist();
          modalBusy = false;
          nav(`results/${s.id}`);
        },
        true,
      );
      break;
    }
    case "delete-session":
      confirmAction(
        "Supprimer cet entretien ?",
        "Les questions, vos réponses et le bilan seront définitivement supprimés. Cette action est irréversible.",
        async () => {
          await api(`/records/${id}`, { method: "DELETE" });
          sessions = sessions.filter((s) => s.id !== id);
          delete local.drafts[id];
          local.favorites = local.favorites.filter(
            (k) => !k.startsWith(`${id}:`),
          );
          await persist();
          forceClose();
          nav("history");
          toast("Cet entretien a été supprimé.");
        },
      );
      break;
    case "favorite": {
      const previousFavorites = local.favorites;
      const added = !local.favorites.includes(id);
      local.favorites = added
        ? [...local.favorites, id]
        : local.favorites.filter((k) => k !== id);
      try {
        await persist(true);
      } catch (error) {
        local.favorites = previousFavorites;
        throw error;
      }
      if (route() === "saved") render();
      else {
        el.innerHTML =
          mi(added ? "favorite" : "favorite_border") +
          (added ? "Retirer des favoris" : "Garder cette question");
      }
      if (local.notifications)
        toast(
          added
            ? "Question ajoutée aux favoris."
            : "Question retirée des favoris.",
        );
      break;
    }
    case "saved-tab":
      savedTab = el.dataset.value ?? "notes";
      render();
      break;
    case "new-note":
      openNote();
      break;
    case "edit-note":
      openNote(id);
      break;
    case "save-note":
      if (!validFields(["note-title", "note-body"])) return;
      if (!value("note-title").trim() || !value("note-body").trim()) {
        field("modal-error").textContent =
          "Saisissez un titre et le contenu de la note.";
        return;
      }
      await working(el, async () => {
        const note: Note = {
          id: id || crypto.randomUUID(),
          title: value("note-title").trim(),
          body: value("note-body").trim(),
          updatedAt: new Date().toISOString(),
        };
        const previousNotes = local.notes;
        local.notes = [note, ...local.notes.filter((n) => n.id !== note.id)];
        try {
          await persist(true);
        } catch (error) {
          local.notes = previousNotes;
          throw error;
        }
        forceClose();
        savedTab = "notes";
        nav("saved");
        render();
        if (local.notifications) toast("Note enregistrée.");
      });
      break;
    case "format": {
      const f = field("note-body");
      const ta = f.shadowRoot?.querySelector("textarea") as
        HTMLTextAreaElement | undefined;
      const start = ta?.selectionStart ?? f.value.length,
        end = ta?.selectionEnd ?? f.value.length;
      const mark = el.dataset.format ?? "**";
      const text = f.value as string;
      f.value =
        text.slice(0, start) +
        mark +
        (text.slice(start, end) || "votre texte") +
        mark +
        text.slice(end);
      f.focus();
      break;
    }
    case "attach-cv": {
      if (!cvs.length) {
        toast(
          "Ajoutez d’abord un CV dans votre espace. Votre note est toujours ouverte.",
        );
        break;
      }
      const f = field("note-body");
      f.value += "\nCV de référence : " + cvs[0].name;
      toast("Nom du CV le plus récent ajouté à votre note.");
      break;
    }
    case "delete-note":
      confirmAction(
        "Supprimer cette note ?",
        "Cette note sera définitivement effacée de ce navigateur.",
        async () => {
          const previousNotes = local.notes;
          local.notes = local.notes.filter((n) => n.id !== id);
          try {
            await persist(true);
          } catch (error) {
            local.notes = previousNotes;
            throw error;
          }
          forceClose();
          render();
          toast("Note supprimée.");
        },
      );
      break;
    case "edit-profile":
      modal(
        "Modifier le nom du profil",
        `<div class="form-stack"><md-outlined-text-field label="Votre nom" id="profile-name" required minlength="2" maxlength="60" value="${esc(user?.name)}"></md-outlined-text-field></div>`,
        `${btn("Annuler", "close", "", "text")}${btn("Enregistrer", "save-profile", "check")}`,
      );
      break;
    case "save-profile":
      if (!validFields(["profile-name"])) return;
      await working(el, async () => {
        await api("/me", {
          method: "PUT",
          body: JSON.stringify({ name: value("profile-name") }),
        });
        user!.name = value("profile-name").trim();
        forceClose();
        render();
        toast("Votre profil a été mis à jour.");
      });
      break;
    case "logout":
      await post("/auth/logout");
      user = null;
      payment = null;
      dataLoaded = false;
      ++gateVersion;
      cvs = [];
      sessions = [];
      local = freshLocal();
      forceClose();
      nav("home");
      render();
      toast("Vous êtes déconnecté. À bientôt.");
      break;
    case "export-all":
      if (!user) {
        openAuth("login");
        break;
      }
      await working(el, async () => {
        const records = await api("/account/export");
        download(
          "interview-prep-mes-donnees.json",
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              profile: user,
              cvs: records.cvs,
              sessions: records.sessions,
              local,
            },
            null,
            2,
          ),
        );
      });
      break;
    case "export-result": {
      const s = sessions.find((s) => s.id === id);
      if (!s?.result) return;
      const r = s.result;
      const text = `INTERVIEW PREP AI\nBilan d’entraînement — ${s.role}\n${date(s.completedAt ?? s.createdAt)}\n\nScore indicatif : ${r.score}/100\n${r.summary}\n\nCRITÈRES\n${r.criteria.map((c) => `${c.name} : ${c.score}/100 — ${c.comment}`).join("\n")}\n\nPOINTS FORTS\n${r.strengths.map((x) => "- " + x).join("\n")}\n\nPOUR PROGRESSER\n${r.improvements.map((x) => "- " + x).join("\n")}\n\n${s.questions.map((q, i) => `QUESTION ${i + 1} — ${q.text}\nVotre réponse : ${s.answers[i]}\nRetour : ${r.feedback[i].comment}\nExemple à adapter : ${r.feedback[i].example}`).join("\n\n")}\n\nBilan automatique de préparation. Ce score ne prédit pas une décision d’embauche.`;
      download("mon-bilan-entretien.txt", text, "text/plain;charset=utf-8");
      break;
    }
    case "clear-local":
      requireUser(() =>
        confirmAction(
          "Effacer les données locales ?",
          "Les notes, favoris, préférences et brouillons de ce compte seront effacés sur cet appareil. Les CV et entretiens enregistrés sur le serveur seront conservés.",
          async () => {
            const previousLocal = local;
            local = freshLocal();
            try {
              await persist(true);
            } catch (error) {
              local = previousLocal;
              throw error;
            }
            forceClose();
            render();
            toast("Les données locales ont été effacées.");
          },
          "Effacer",
        ),
      );
      break;
    case "delete-account":
      confirmAction(
        "Supprimer définitivement votre compte ?",
        "Votre compte, toutes vos analyses de CV et tous vos entretiens seront supprimés du serveur. Les données locales seront effacées sur cet appareil. Exportez vos données avant de continuer. Cette action est irréversible.",
        async () => {
          const uid = user!.id;
          await api("/me", { method: "DELETE" });
          let localCleanupFailed = false;
          try {
            await del(`prep:${uid}`);
          } catch {
            localCleanupFailed = true;
          }
          user = null;
          payment = null;
          dataLoaded = false;
          ++gateVersion;
          cvs = [];
          sessions = [];
          local = freshLocal();
          forceClose();
          pendingRoute = "home";
          authNext = undefined;
          nav("welcome");
          toast(
            localCleanupFailed
              ? "Votre compte a été supprimé du serveur. L’effacement local a échoué : effacez les données du site dans les paramètres de ce navigateur."
              : "Votre compte et ses données ont été supprimés.",
          );
        },
        "Supprimer mon compte",
      );
      break;
    case "confirm":
      if (confirmFn) await working(el, confirmFn);
      break;
  }
}
document.addEventListener("click", (e) => {
  const elements = e
    .composedPath()
    .filter((n): n is Element => n instanceof Element);
  const el = elements.find((n) => n.hasAttribute("data-act")) as
    HTMLElement | undefined;
  if (el) {
    if (el.hasAttribute("disabled")) return;
    if (modalBusy && el.dataset.act !== "toggle-password") {
      toast("Opération en cours. Veuillez patienter.");
      return;
    }
    e.preventDefault();
    void action(el.dataset.act!, el).catch((error) =>
      toast(
        error instanceof Error ? error.message : "Une erreur est survenue.",
      ),
    );
    return;
  }
  const link = elements.find((n) => n.matches('a[href^="#"]')) as
    HTMLAnchorElement | undefined;
  if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
    e.preventDefault();
    authNext = undefined;
    nav(link.hash.slice(1));
  }
});
document.addEventListener("submit", (e) => {
  if ((e.target as HTMLElement).id !== "auth-form") return;
  e.preventDefault();
  document
    .querySelector<HTMLElement>(
      '#auth-form [data-act="submit-register"],#auth-form [data-act="submit-login"]',
    )
    ?.click();
});
document.addEventListener("input", (e) => {
  const target = e.target as HTMLElement;
  if (target.id === "global-search") {
    search = value("global-search");
    field("search-results").innerHTML = searchResults();
  }
  if (target.id === "answer") {
    const s = currentSession();
    if (!s) return;
    const answers = [...(local.drafts[s.id] ?? s.answers)];
    answers[currentQuestion] = value("answer");
    local.drafts[s.id] = answers;
    const status = field("draft-status");
    if (status) status.textContent = "Enregistrement du brouillon…";
    void persist().then((ok) => {
      if (status?.isConnected)
        status.textContent = ok
          ? "Brouillon enregistré sur cet appareil"
          : "Brouillon non enregistré : ne fermez pas cette page.";
    });
    field("answer-count").textContent =
      `${answers[currentQuestion].length} / 6 000 caractères`;
  }
});
document.addEventListener("change", (e) => {
  const target = e.target as HTMLElement;
  if (target.id === "pdf-input")
    chooseFile((target as HTMLInputElement).files?.[0]);
  if (target.id === "notifications") {
    requireUser(() => {
      local.notifications = field("notifications").selected;
      void persist();
      toast(
        local.notifications
          ? "Confirmations d’enregistrement activées."
          : "Confirmations d’enregistrement désactivées.",
      );
    });
    if (!user) (target as any).selected = local.notifications;
  }
});
document.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (e.key === "Enter" && target.id === "home-search") {
    search = value("home-search");
    nav("search");
  }
  if (
    e.key === "Enter" &&
    ["auth-email", "auth-password", "auth-name"].includes(target.id)
  ) {
    e.preventDefault();
    const b = document.querySelector<HTMLElement>(
      '[data-act="submit-register"],[data-act="submit-login"]',
    );
    b?.click();
  }
  if (
    (e.key === "Enter" || e.key === " ") &&
    target.classList.contains("drop-zone")
  ) {
    e.preventDefault();
    field("pdf-input")?.click();
  }
});
document.addEventListener("dragover", (e) => {
  const zone = (e.target as HTMLElement).closest(".drop-zone");
  if (zone) {
    e.preventDefault();
    zone.classList.add("over");
  }
});
document.addEventListener("dragleave", (e) => {
  (e.target as HTMLElement).closest(".drop-zone")?.classList.remove("over");
});
document.addEventListener("drop", (e) => {
  const zone = (e.target as HTMLElement).closest(".drop-zone");
  if (zone) {
    e.preventDefault();
    zone.classList.remove("over");
    chooseFile(e.dataTransfer?.files[0]);
  }
});
window.addEventListener("popstate", () => {
  if (modalBusy) {
    history.pushState({ prep: true }, "", renderedHash || "#home");
    toast(
      "Une opération est en cours. Attendez sa fin pour quitter cette page.",
    );
    return;
  }
  backward = true;
  applyRoute();
});
window.addEventListener("hashchange", () => {
  if (location.hash === renderedHash) return;
  if (modalBusy) {
    history.replaceState({ prep: true }, "", renderedHash || "#home");
    toast("Opération en cours. Veuillez patienter.");
    return;
  }
  backward = true;
  applyRoute();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelector(".sidebar")?.classList.remove("open");
    document.querySelector(".mobile-scrim")?.classList.remove("open");
    document.querySelector(".marketing-nav")?.classList.remove("open");
    document
      .querySelector(".public-menu-button")
      ?.setAttribute("aria-expanded", "false");
  }
});
window.addEventListener("offline", () =>
  toast(
    "Vous êtes hors ligne. Les brouillons et notes restent sur cet appareil.",
  ),
);
window.addEventListener("online", () => toast("La connexion est rétablie."));
const disposeSiteMotion = initSiteMotion(app);
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) disposeSiteMotion();
});
render();
async function boot() {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (res.ok) {
      user = await res.json();
      await loadLocal();
      await refresh();
    } else if (res.status !== 401) {
      toast("Le serveur est indisponible. Réessayez dans un instant.");
    }
  } catch {
    toast(
      "Impossible de joindre le serveur. Les fonctions du compte nécessitent une connexion.",
    );
  } finally {
    ready = true;
    applyRoute();
  }
}
void boot();
