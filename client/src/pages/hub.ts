import { wordmark } from "../brand";
export type HubUser = {
  id: string;
  name: string;
  email: string;
  is_admin?: boolean;
};
export const publicHubRoutes = [
  "about",
  "support",
  "contact",
  "legal",
  "privacy",
  "terms",
];
export const isHubRoute = (r: string) =>
  publicHubRoutes.includes(r.split("?")[0]) ||
  /^(tickets|admin)(\/|\?|$)/.test(r);
export const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const e = escapeHtml;
const ico = (s: string) => `<span class="icon" aria-hidden="true">${s}</span>`;
const link = (href: string, text: string) =>
  `<a class="hub-link" href="#${e(href)}">${e(text)}${ico("arrow_forward")}</a>`;
const button = (label: string, act: string, style = "filled", extra = "") =>
  `<md-${style}-button type="button" data-hub="${act}" ${extra}>${e(label)}</md-${style}-button>`;
const field = (id: string, label: string, max: number, opts = "") =>
  `<md-outlined-text-field id="${id}" label="${e(label)}" maxlength="${max}" ${opts}></md-outlined-text-field>`;
const select = (
  id: string,
  label: string,
  values: Record<string, string>,
  selected: string,
) =>
  `<md-outlined-select id="${id}" label="${e(label)}">${Object.entries(values)
    .map(
      ([v, t]) =>
        `<md-select-option value="${e(v)}" ${v === selected ? "selected" : ""}><div slot="headline">${e(t)}</div></md-select-option>`,
    )
    .join("")}</md-outlined-select>`;
const date = (d: string) =>
  new Date(d).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const heading = (eyebrow: string, title: string, desc: string, actions = "") =>
  `<header class="hub-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${actions}</header>`;
const errorSlot =
  '<p id="hub-error" class="form-error" role="alert"></p><p id="hub-status" role="status" aria-live="polite"></p>';
const empty = (title: string, text: string) =>
  `<div class="hub-empty">${ico("inbox")}<h2>${e(title)}</h2><p>${e(text)}</p></div>`;
const categories = {
  general: "Question générale",
  technical: "Problème technique",
  billing: "Paiement et accès",
  privacy: "Données personnelles",
};
const states: Record<string, string> = {
  open: "À traiter",
  waiting: "Réponse du support",
  closed: "Fermée",
};
const status = (s: string) =>
  `<span class="ticket-state state-${e(s)}">${e(states[s] ?? s)}</span>`;
const loading =
  '<div class="hub-loading" role="status"><md-circular-progress indeterminate aria-label="Chargement"></md-circular-progress><p>Chargement des informations…</p></div>';
export function hubPage() {
  return `<section class="hub" id="hub-root">${loading}</section>`;
}

export const faq = [
  [
    "Commencer",
    "Comment préparer mon premier entretien ?",
    "Créez un compte, activez votre accès, puis importez un CV PDF de moins de 8 Mo. Après l’analyse, choisissez le poste, votre niveau et un entretien de cinq ou huit questions. Les réponses se rédigent à votre rythme.",
  ],
  [
    "Paiement",
    "J’ai payé mais mon accès est encore bloqué.",
    "N’effectuez pas un deuxième achat. Consultez la page de confirmation du paiement. Si le problème persiste, ouvrez une demande dans la catégorie Paiement et accès en indiquant la référence de vente, jamais vos coordonnées bancaires.",
  ],
  [
    "CV",
    "Pourquoi mon PDF est-il refusé ?",
    "Le fichier doit être un PDF lisible de moins de 8 Mo contenant un CV. Un document endommagé, protégé ou peu lisible peut être refusé. Exportez à nouveau votre CV au format PDF puis réessayez.",
  ],
  [
    "Entretien",
    "Est-ce un entretien vidéo ou un recruteur en direct ?",
    "Non. Il s’agit d’un entraînement écrit avec des questions personnalisées et un bilan assisté par IA. Aucun recruteur humain ne participe à votre session.",
  ],
  [
    "Données",
    "Où sont mes notes et mes brouillons ?",
    "Les notes, favoris et brouillons restent dans le navigateur de cet appareil. Les analyses et entretiens enregistrés sont liés à votre compte. Exportez vos données avant de nettoyer le stockage du navigateur.",
  ],
  [
    "Support",
    "Comment recevoir une réponse à ma demande ?",
    "Revenez dans Mes demandes pour lire la réponse et poursuivre la conversation. Aucun e-mail de notification n’est envoyé. Le support ne fonctionne pas en chat instantané et aucun délai de réponse n’est garanti.",
  ],
  [
    "Compte",
    "Comment exporter ou supprimer mes données ?",
    "Dans Paramètres, exportez vos données ou supprimez votre compte. La suppression du compte efface aussi vos demandes de support. Les références de paiement nécessaires à la prévention des doublons sont conservées sans lien avec le compte supprimé.",
  ],
  [
    "Compte",
    "J’ai oublié mon mot de passe.",
    "La réinitialisation automatique par e-mail n’est pas disponible. Si une adresse publique de l’éditeur est renseignée sur la page Contact, utilisez-la. Ne communiquez jamais votre mot de passe ni une clé privée.",
  ],
];
function faqList(q = "") {
  const rows = faq.filter((row) =>
    row.join(" ").toLocaleLowerCase("fr").includes(q.toLocaleLowerCase("fr")),
  );
  return rows.length
    ? rows
        .map(
          ([cat, title, body]) =>
            `<details class="hub-faq"><summary><span><small>${e(cat)}</small>${e(title)}</span>${ico("expand_more")}</summary><p>${e(body)}</p></details>`,
        )
        .join("")
    : empty(
        "Aucune réponse trouvée",
        "Essayez un autre mot ou écrivez au support.",
      );
}
function adminNav(path: string) {
  return `<div class="admin-context"><span>${ico("admin_panel_settings")} Administration privée</span>${link("home", "Mon espace de préparation")}</div><nav class="hub-tabs" aria-label="Administration">${[
    ["admin", "Vue d’ensemble"],
    ["admin/users", "Utilisateurs"],
    ["admin/payments", "Paiements"],
    ["admin/tickets", "Support"],
    ["admin/site", "Informations publiques"],
  ]
    .map(
      ([r, t]) =>
        `<a href="#${r}" ${path === r ? 'aria-current="page"' : ""}>${t}</a>`,
    )
    .join("")}</nav>`;
}
const pager = (total: number, page: number, size: number) =>
  `<nav class="hub-pager" aria-label="Pagination">${button("Précédent", "prev", "outlined", page <= 1 ? "disabled" : "")}<span>Page ${page} · ${total} résultat${total > 1 ? "s" : ""}</span>${button("Suivant", "next", "outlined", page * size >= total ? "disabled" : "")}</nav>`;
function ticketRows(items: any[], isAdmin: boolean) {
  return items
    .map(
      (t) =>
        `<a class="ticket-row" href="#${isAdmin ? "admin/tickets" : "tickets"}/${e(t.id)}"><div><h3>${e(t.subject)}</h3><p>${e((categories as Record<string, string>)[t.category])}${isAdmin ? ` · ${e(t.name)} · ${e(t.email)}` : ""}</p><small>${e(date(t.updated_at))}</small></div>${status(t.status)}${ico("chevron_right")}</a>`,
    )
    .join("");
}
class HubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function mountHub(
  root: HTMLElement,
  route: string,
  user: HubUser | null,
  nav: (r: string) => void,
  onAuth: () => void,
): () => void {
  const controller = new AbortController();
  let requestId = crypto.randomUUID();
  let pending = false;
  let retry = () => void load();
  const [path, query = ""] = route.split("?");
  const params = new URLSearchParams(query);
  let page = Math.max(1, Number(params.get("page")) || 1);
  const isAdmin = path === "admin" || path.startsWith("admin/");
  const prefix = isAdmin
    ? adminNav(path.startsWith("admin/tickets/") ? "admin/tickets" : path)
    : "";
  const alive = () => root.isConnected && !controller.signal.aborted;
  let dismissConfirm: (() => void) | undefined;
  function confirmDialog(message: string): Promise<boolean> {
    if (dismissConfirm) return Promise.resolve(false);
    return new Promise((resolve) => {
      const dialog = document.createElement("md-dialog") as HTMLElement & {
        show: () => Promise<void>;
        close: () => Promise<void>;
      };
      dialog.innerHTML = `<div slot="headline">Confirmer l’action</div><div slot="content">${e(message)}</div><div slot="actions"><md-text-button data-confirm="no">Annuler</md-text-button><md-filled-button data-confirm="yes">Confirmer</md-filled-button></div>`;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        dismissConfirm = undefined;
        dialog.remove();
        resolve(ok);
      };
      dismissConfirm = () => finish(false);
      dialog.addEventListener("click", (event) => {
        const b = event
          .composedPath()
          .find((n) => n instanceof HTMLElement && n.dataset.confirm) as
          HTMLElement | undefined;
        if (b) {
          event.stopPropagation();
          finish(b.dataset.confirm === "yes");
        }
      });
      dialog.addEventListener("cancel", () => finish(false));
      root.append(dialog);
      void dialog.show();
    });
  }

  const value = (id: string) =>
    (root.querySelector(`#${id}`) as HTMLInputElement | null)?.value?.trim() ??
    "";
  const show = (html: string) => {
    if (alive()) {
      root.innerHTML = prefix + html;
      queueMicrotask(() => {
        if (alive())
          root.dispatchEvent(new Event("prep:view-ready", { bubbles: true }));
      });
    }
  };
  const fail = (err: unknown) => {
    if (!alive()) return;
    if (err instanceof HubError && err.status === 401) {
      onAuth();
      return;
    }
    const message =
      err instanceof Error
        ? err.message
        : "La demande n’a pas abouti. Réessayez.";
    const slot = root.querySelector("#hub-error");
    if (slot) slot.textContent = message;
    else
      show(
        heading(
          "INFORMATION",
          err instanceof HubError && err.status === 403
            ? "Accès réservé"
            : "Informations indisponibles",
          e(message),
        ) +
          button("Réessayer", "retry", "outlined") +
          link("home", "Retour à mon espace"),
      );
  };
  async function request(url: string, method = "GET", data?: unknown) {
    const frozen =
      method === "GET"
        ? []
        : [
            ...root.querySelectorAll<HTMLElement>(
              "md-outlined-text-field:not([disabled]),md-outlined-select:not([disabled])",
            ),
          ];
    frozen.forEach((f) => f.setAttribute("disabled", ""));
    const child = new AbortController();
    const abort = () => child.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    if (controller.signal.aborted) abort();
    const timer = window.setTimeout(abort, 20000);
    try {
      const res = await fetch("/api" + url, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        signal: child.signal,
        headers: {
          "X-Requested-With": "InterviewPrep",
          ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new HubError(
          body.error ?? "La demande n’a pas abouti.",
          res.status,
        );
      return body;
    } catch (err) {
      if (err instanceof HubError) throw err;
      throw new Error(
        child.signal.aborted
          ? "Délai dépassé. Vérifiez la liste avant de réessayer : la demande a peut-être été enregistrée."
          : "Connexion impossible. Vos champs sont conservés sur cette page.",
      );
    } finally {
      frozen.forEach((f) => f.removeAttribute("disabled"));
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", abort);
    }
  }
  function publicContact(site: any) {
    return site.email
      ? `<p>Si vous ne pouvez pas accéder à votre compte : <a href="mailto:${e(site.email)}">${e(site.email)}</a>.</p>`
      : "<p>Aucune adresse e-mail publique n’a encore été renseignée par l’éditeur. La messagerie nécessite un compte connecté.</p>";
  }
  async function load() {
    try {
      if (isAdmin && !user?.is_admin) {
        show(
          heading(
            "ESPACE PRIVÉ",
            "Administration réservée",
            "Votre compte n’a pas accès à cet espace.",
          ) + link("home", "Revenir à ma préparation"),
        );
        return;
      }
      if (path === "support") {
        show(
          heading(
            "CENTRE D’AIDE",
            "On vous aide à avancer.",
            "Un problème de CV, d’accès ou de paiement ? Retrouvez les réponses utiles et vos échanges avec le support.",
          ) +
            `<div class="help-layout"><section>${field("faq-search", "Rechercher dans l’aide", 100, 'type="search"')}<div id="faq-results" class="faq-list">${faqList()}</div></section><aside class="hub-panel help-aside">${ico("forum")}<h2>Parlons de votre demande.</h2><p>Une conversation privée, liée à votre compte. Accessible même sans paiement.</p>${link("contact", "Écrire au support")}${link("tickets", "Mes demandes")}${link("merci", "Vérifier mon paiement")}<small>Pas de notification e-mail. Revenez consulter votre conversation.</small></aside></div>`,
        );
        return;
      }
      if (path === "about") {
        show(
          heading(
            "À PROPOS",
            "Mieux raconter ce que vous savez faire.",
            "Interview Prep AI est un espace d’entraînement écrit, construit autour de votre parcours.",
          ) +
            `<div class="hub-story"><section class="hub-panel"><div class="story-number">01</div><h2>Partir du concret.</h2><p>Votre CV sert à préparer des questions adaptées au poste visé. Vous choisissez votre niveau et le nombre de questions.</p></section><section class="hub-panel"><div class="story-number">02</div><h2>Prendre le temps.</h2><p>Pas de chronomètre ni de caméra. Rédigez vos réponses, reprenez votre session et appuyez-vous sur des expériences vérifiables.</p></section><section class="hub-panel"><div class="story-number">03</div><h2>Retravailler ses réponses.</h2><p>Le bilan aide à identifier des pistes d’amélioration. Il peut contenir des erreurs et ne prédit pas une décision d’embauche.</p></section></div><div class="hub-note">${wordmark()}<p>Un outil de préparation, pas une promesse d’embauche ou un entretien avec un recruteur.</p>${link("practice", "Préparer un entretien")}${link("privacy", "Comprendre le traitement des données")}</div>`,
        );
        return;
      }
      if (path === "contact") {
        // Do not wait for public configuration to make the signed-in contact form usable.
        show(
          heading(
            "CONTACT",
            "Une question ? Écrivez-nous.",
            "Votre demande et les réponses sont conservées dans votre espace. Le support est accessible sans achat.",
          ) +
            `<div class="help-layout"><section class="hub-panel">${user ? `<form id="ticket-form" novalidate><h2>Nouvelle demande</h2><p>Envoyée depuis ${e(user.email)}.</p><div class="hub-form">${select("ticket-category", "Catégorie", categories, "general")}${field("ticket-subject", "Objet de votre demande", 140, 'required minlength="4"')}${field("ticket-body", "Décrivez votre demande", 6000, 'type="textarea" rows="7" required minlength="10" supporting-text="10 à 6 000 caractères. Ne joignez ni mot de passe, ni CV, ni données bancaires."')}${errorSlot}${button("Envoyer la demande", "send-ticket")}</div></form>` : `<h2>Connectez-vous pour nous écrire.</h2><p>Le compte permet de conserver vos messages et d’éviter qu’un autre utilisateur consulte vos demandes. Aucun paiement n’est nécessaire.</p>${link("tickets", "Se connecter et accéder à la messagerie")}`}</section><aside class="hub-panel help-aside"><h2>Le suivi, au même endroit.</h2><p>Après l’envoi, retrouvez votre conversation dans Mes demandes. Aucun e-mail n’est envoyé et aucun délai de réponse n’est garanti.</p>${link("tickets", "Mes demandes")}${link("support", "Consulter l’aide")}<div id="public-contact" role="status">Chargement des coordonnées publiques…</div></aside></div>`,
        );
        try {
          const site = await request("/site");
          if (alive())
            root.querySelector("#public-contact")!.innerHTML =
              publicContact(site);
        } catch {
          if (alive())
            root.querySelector("#public-contact")!.textContent =
              "Coordonnées publiques indisponibles. Vous pouvez utiliser la messagerie ci-contre si vous êtes connecté.";
        }
        return;
      }
      if (["legal", "privacy", "terms"].includes(path)) {
        const site = await request("/site");
        if (!alive()) return;
        const incomplete = !site.publisher || !site.country || !site.address;
        const publisher = `<section class="hub-panel"><h2>Éditeur du service</h2>${incomplete ? '<p class="hub-warning">Les coordonnées de l’éditeur sont incomplètes. Elles doivent être renseignées par l’éditeur avant de considérer ces informations comme finalisées.</p>' : ""}<dl class="hub-definition">${[
          ["Nom / raison sociale", site.publisher],
          ["Pays", site.country],
          ["Adresse professionnelle", site.address],
          ["Immatriculation (si applicable)", site.registration],
        ]
          .map(
            ([k, v]) =>
              `<div><dt>${e(k)}</dt><dd>${e(v || "Non renseigné")}</dd></div>`,
          )
          .join(
            "",
          )}</dl>${publicContact(site)}${link("contact", "Contacter le support")}</section>`;
        const texts: Record<string, string> = {
          legal: `${publisher}<section class="hub-panel"><h2>Hébergement et prestataires</h2><p>L’application est déployée sur Render. Les données des comptes et les conversations de support sont conservées dans PostgreSQL sur Supabase. Les analyses utilisent Google Gemini ; les paiements utilisent Chariow.</p><h2>Objet du site</h2><p>Préparation écrite aux entretiens professionnels. Le service ne représente pas un employeur et ne garantit ni entretien réel ni recrutement.</p><p>Ces informations décrivent le fonctionnement technique. L’éditeur doit compléter ses obligations légales selon sa situation et les pays concernés.</p></section>`,
          privacy: `<section class="hub-panel"><h2>Ce que l’application conserve</h2><p>Votre nom, votre e-mail et une empreinte sécurisée du mot de passe servent au compte. Les analyses de CV, sessions, réponses, bilans et demandes de support sont enregistrés dans votre compte.</p><p>Le PDF original est transmis à Gemini après votre consentement pour l’analyse, mais n’est pas conservé comme fichier sur notre serveur. Les réponses d’entretien sont également transmises à Gemini pour générer le bilan. Retirez les données sensibles inutiles.</p><h2>Sur votre appareil</h2><p>Un cookie de session sécurise la connexion. Les notes, favoris et brouillons utilisent le stockage local du navigateur. Les confirmations d’enregistrement ne sont pas des notifications e-mail.</p><h2>Qui peut voir quoi ?</h2><p>Vos créations sont isolées par compte. Le dashboard admin affiche les informations de compte, les accès, les références de paiement et les échanges de support, mais ne propose pas de consulter les CV, réponses ou bilans individuels. L’opérateur de l’infrastructure peut disposer d’un accès technique aux données.</p><h2>Conservation et suppression</h2><p>Les données du compte et les tickets restent enregistrés jusqu’à la suppression du compte ou des éléments concernés. Les références minimales de paiement sont conservées sans lien avec le compte supprimé afin d’éviter une activation en double ; aucun nom, e-mail ou numéro de téléphone n’est conservé dans ces reçus.</p><p>Exportez vos données depuis Paramètres et vos conversations depuis Mes demandes. La suppression d’un compte efface les tickets et messages associés ; les notes et brouillons d’autres appareils doivent être effacés sur ces appareils.</p><h2>Prestataires externes</h2><p>Les données transmises à Google Gemini et Chariow sont aussi soumises aux règles de ces prestataires. Cette application ne peut pas garantir leur effacement immédiat. L’éditeur doit préciser les bases légales, durées complémentaires et modalités de transfert applicables à son activité.</p>${link("tickets", "Mes demandes et export")}${link("settings", "Gérer mes données")}</section>${publisher}`,
          terms: `<section class="hub-panel"><h2>Utiliser le service</h2><p>Utilisez vos propres documents ou ceux que vous êtes autorisé à traiter. Gardez vos identifiants confidentiels et n’utilisez pas le service pour transmettre des contenus illicites ou des données sensibles inutiles.</p><h2>Accès et paiement</h2><p>Le tarif et la devise sont ceux du produit Chariow configuré, affichés sur la page Tarif et accès. L’accès payant n’est activé qu’après confirmation sécurisée du paiement sur votre compte. Le compte administrateur bénéficie d’un accès distinct, sans achat.</p><p>Les modalités de vente, de rétractation et de remboursement doivent être précisées par le vendeur selon ses obligations. Aucun délai ni droit contractuel supplémentaire n’est inventé ici. En cas de problème, contactez le support avant de repayer.</p><h2>Limites de l’entraînement</h2><p>Questions et bilans assistés par IA peuvent être incomplets ou erronés. Le score est un repère de préparation, pas une certification ni une décision de recrutement. Le service dépend de la disponibilité de son hébergeur et de ses prestataires.</p><h2>Vos contenus</h2><p>Vous restez responsable des contenus que vous fournissez. Vous pouvez exporter vos données et supprimer votre compte depuis Paramètres.</p><p class="hub-warning">Cette page décrit l’usage du service. Les conditions commerciales et mentions légales doivent être finalisées par l’éditeur ; ce texte ne constitue pas une validation juridique.</p>${link("pricing", "Consulter le tarif")}${link("contact", "Contacter le support")}</section>${publisher}`,
        };
        show(
          heading(
            "INFORMATIONS",
            {
              legal: "Mentions légales",
              privacy: "Vos données, clairement.",
              terms: "Conditions d’utilisation",
            }[path]!,
            "Fonctionnement du service et informations publiées par son éditeur.",
          ) + `<div class="legal-layout">${texts[path]}</div>`,
        );
        return;
      }
      if (path === "tickets" || path === "admin/tickets") {
        const endpoint = isAdmin ? "/admin/tickets" : "/support/tickets";
        const q = params.get("q") ?? "",
          filter = params.get("status") ?? "all";
        const data = await request(
          `${endpoint}?page=${page}&q=${encodeURIComponent(q)}&status=${encodeURIComponent(filter)}`,
        );
        if (!alive()) return;
        show(
          heading(
            isAdmin ? "RELATION UTILISATEURS" : "VOTRE MESSAGERIE",
            isAdmin ? "Demandes de support" : "Mes demandes",
            isAdmin
              ? "Consultez les échanges et répondez aux demandes réelles."
              : "Retrouvez vos réponses ici. Aucun e-mail de notification n’est envoyé.",
            isAdmin
              ? button("Actualiser", "reload", "outlined")
              : link("contact", "Nouvelle demande"),
          ) +
            (isAdmin
              ? `<form class="hub-filters" id="hub-filter">${field("filter-q", "Objet ou e-mail", 100, `value="${e(q)}" type="search"`)}${select("filter-status", "État", { all: "Tous les états", ...states }, filter)}${button("Filtrer", "filter", "outlined")}</form>`
              : `<div class="hub-toolbar">${button("Actualiser", "reload", "outlined")}${button("Exporter mes conversations", "export", "text")}</div>`) +
            errorSlot +
            `<div class="hub-panel ticket-list">${data.items.length ? ticketRows(data.items, isAdmin) : empty("Aucune demande à afficher", isAdmin ? "Les demandes reçues apparaîtront ici. Modifiez les filtres si nécessaire." : "Vous n’avez pas encore envoyé de demande au support.")}</div>` +
            pager(data.total, page, 20),
        );
        return;
      }
      if (/^tickets\//.test(path) || /^admin\/tickets\//.test(path)) {
        const id = path.split("/").at(-1)!;
        const data = await request(
          `/support/tickets/${encodeURIComponent(id)}?page=${page}`,
        );
        if (!alive()) return;
        const t = data.ticket;
        show(
          link(isAdmin ? "admin/tickets" : "tickets", "Toutes les demandes") +
            heading(
              "CONVERSATION PRIVÉE",
              e(t.subject),
              `${e((categories as Record<string, string>)[t.category])} · Créée le ${e(date(t.created_at))}`,
            ) +
            `<div class="thread-context">${status(t.status)}${data.customer ? `<p>${e(data.customer.name)} · ${e(data.customer.email)}</p>` : ""}<small>Référence ${e(t.id)}</small>${button("Actualiser", "reload", "outlined")}</div><div class="thread-messages" aria-label="Messages">${data.messages.map((m: any) => `<article class="thread-message ${m.from_admin ? "from-support" : "from-user"}"><header><strong>${m.from_admin ? "Support" : "Demandeur"}</strong><time datetime="${e(m.created_at)}">${e(date(m.created_at))}</time></header><p>${e(m.body)}</p></article>`).join("")}</div>${pager(data.total, page, 50)}<section class="hub-panel reply-panel">${t.status === "closed" ? `<h2>Cette demande est fermée.</h2><p>Vous pouvez la rouvrir pour poursuivre la conversation.</p>${button("Rouvrir la demande", "reopen", "outlined")}${errorSlot}` : `<form id="reply-form" novalidate><h2>${isAdmin ? "Répondre à l’utilisateur" : "Ajouter un message"}</h2>${field("reply-body", "Votre message", 6000, 'type="textarea" rows="5" required minlength="2"')}${errorSlot}<div class="hub-toolbar">${button("Envoyer la réponse", "send-reply")}${button("Fermer la demande", "close-ticket", "outlined")}</div></form>`}</section>`,
        );
        return;
      }
      if (path === "admin") {
        const d = await request("/admin/overview");
        if (!alive()) return;
        show(
          heading(
            "PILOTAGE",
            "Vue d’ensemble",
            `Les données de votre application, au ${e(date(d.as_of))}.`,
            button("Actualiser", "reload", "outlined"),
          ) +
            `<div class="admin-free"><div>${ico("verified_user")}<strong>Votre compte admin : accès gratuit</strong><p>Analyses et créations sont accessibles sans achat. Les quotas du fournisseur d’IA restent applicables.</p></div>${link("practice", "Créer un entretien")}</div><div class="metric-grid">${[
              [d.users, "Comptes", "admin/users"],
              [d.paid_users, "Comptes payants", "admin/users?access=paid"],
              [
                d.open_tickets,
                "Demandes à traiter",
                "admin/tickets?status=open",
              ],
              [d.receipts, "Reçus de paiement", "admin/payments"],
            ]
              .map(
                ([n, t, r]) =>
                  `<a class="metric-card" href="#${r}"><span>${t}</span><strong>${n}</strong>${ico("arrow_forward")}</a>`,
              )
              .join(
                "",
              )}</div><div class="admin-lower"><section class="hub-panel"><div class="eyebrow">SUPPORT</div><h2>Les conversations en cours</h2><dl class="hub-definition"><div><dt>À traiter</dt><dd>${d.open_tickets}</dd></div><div><dt>Réponse du support envoyée</dt><dd>${d.waiting_tickets}</dd></div><div><dt>Fermées</dt><dd>${d.closed_tickets}</dd></div></dl>${link("admin/tickets", "Ouvrir la messagerie")}</section><section class="hub-panel"><div class="eyebrow">ACTIVITÉ GLOBALE</div><h2>La préparation, en chiffres</h2><dl class="hub-definition"><div><dt>Analyses de CV enregistrées</dt><dd>${d.cvs}</dd></div><div><dt>Entretiens enregistrés</dt><dd>${d.sessions}</dd></div></dl><p>Ces compteurs n’exposent pas le contenu privé des créations.</p><small>Les montants historiques ne sont pas stockés dans les reçus. Aucun chiffre d’affaires n’est calculé.</small></section></div>`,
        );
        return;
      }
      if (path === "admin/users" || path === "admin/payments") {
        const users = path === "admin/users",
          q = params.get("q") ?? "",
          access = params.get("access") ?? "all";
        const d = await request(
          `/${path}?page=${page}&q=${encodeURIComponent(q)}&access=${encodeURIComponent(access)}`,
        );
        if (!alive()) return;
        const table = users
          ? `<thead><tr><th scope="col">Compte</th><th scope="col">Accès</th><th scope="col">Paiement</th></tr></thead><tbody>${d.items.map((u: any) => `<tr><td><strong>${e(u.name)}</strong><span>${e(u.email)}</span><small>ID ${e(u.id)}</small></td><td>${u.is_admin ? '<span class="ticket-state state-waiting">Admin · gratuit</span>' : u.is_paid ? '<span class="ticket-state state-waiting">Payant actif</span>' : '<span class="ticket-state">Non activé</span>'}</td><td>${u.is_paid ? e(u.paid_at ? date(u.paid_at) : "Paiement enregistré") : "Aucun paiement enregistré"}</td></tr>`).join("")}</tbody>`
          : `<thead><tr><th scope="col">Référence de vente</th><th scope="col">Compte</th><th scope="col">Notification reçue</th></tr></thead><tbody>${d.items.map((p: any) => `<tr><td><strong>${e(p.sale_id)}</strong><small>Produit ${e(p.product_id)}</small></td><td>${e(p.name ?? "Compte supprimé")}<span>${e(p.email ?? "Sans lien avec un compte")}</span></td><td>${e(date(p.received_at))}</td></tr>`).join("")}</tbody>`;
        show(
          heading(
            "ADMINISTRATION",
            users ? "Utilisateurs et accès" : "Paiements enregistrés",
            users
              ? "Consultez les comptes et leur accès. Aucun CV, mot de passe ou entretien privé n’est affiché."
              : "Notifications signées enregistrées par l’application. Ce n’est ni un relevé bancaire ni le catalogue de ventes Chariow.",
          ) +
            `<form class="hub-filters" id="hub-filter">${field("filter-q", users ? "Nom ou e-mail" : "Vente ou e-mail", 100, `type="search" value="${e(q)}"`)}${users ? select("filter-access", "Accès", { all: "Tous les comptes", paid: "Avec paiement", unpaid: "Sans accès", admin: "Administrateur" }, access) : ""}${button("Rechercher", "filter", "outlined")}${button("Actualiser", "reload", "text")}</form>${errorSlot}<div class="hub-panel">${d.items.length ? `<div class="hub-table-wrap" role="region" aria-label="${users ? "Utilisateurs" : "Paiements"}" tabindex="0"><table class="hub-table">${table}</table></div>` : empty("Aucun résultat", "Aucune donnée ne correspond à ces critères.")}</div>${pager(d.total, page, 20)}<p class="hub-fineprint">${users ? "Le rôle admin ne se distribue pas ici : il se gère uniquement dans Supabase, via le champ is_admin. Un seul administrateur est autorisé. Aucun accès payant n’est accordé manuellement." : "Aucun montant historique ou remboursement n’est inventé. Pour la gestion financière, utilisez votre tableau de bord Chariow."}</p>`,
        );
        return;
      }
      if (path === "admin/site") {
        const site = await request("/site");
        if (!alive()) return;
        show(
          heading(
            "PUBLICATION",
            "Informations de l’éditeur",
            "Ces coordonnées sont publiques. N’y saisissez aucune clé, aucun mot de passe ou secret de configuration.",
          ) +
            `<section class="hub-panel publisher-panel"><p>Les champs non renseignés sont signalés comme tels sur les pages légales. Ce formulaire ne remplace pas une vérification juridique.</p><form id="site-form" data-version="${site.version}" novalidate><div class="hub-form">${field("site-publisher", "Nom / raison sociale", 160, `value="${e(site.publisher)}"`)}${field("site-country", "Pays", 100, `value="${e(site.country)}"`)}${field("site-address", "Adresse professionnelle publique", 400, `value="${e(site.address)}" type="textarea" rows="3"`)}${field("site-email", "E-mail public (facultatif)", 200, `value="${e(site.email)}" type="email"`)}${field("site-registration", "Immatriculation (si applicable)", 160, `value="${e(site.registration)}"`)}${errorSlot}<div class="hub-toolbar">${button("Publier les informations", "save-site")}${button("Recharger les informations", "reload", "outlined")}</div></div></form>${link("legal", "Voir les mentions légales")}</section>`,
        );
        return;
      }
      show(
        heading(
          "PAGE INTROUVABLE",
          "Cette page n’existe pas.",
          "Utilisez la navigation pour retrouver votre espace.",
        ) + link("home", "Revenir à mon espace"),
      );
    } catch (err) {
      fail(err);
    }
  }
  function valid(ids: string[]) {
    let ok = true;
    for (const id of ids) {
      const f = root.querySelector(`#${id}`) as any;
      if (f?.reportValidity && !f.reportValidity()) ok = false;
    }
    return ok;
  }
  function toPage(n: number) {
    const p = new URLSearchParams(query);
    p.set("page", String(n));
    nav(path + "?" + p.toString());
  }
  async function act(action: string, el: HTMLElement) {
    if (pending) return;
    if (action === "prev" || action === "next") {
      toPage(page + (action === "prev" ? -1 : 1));
      return;
    }
    if (action === "filter") {
      const p = new URLSearchParams();
      p.set("q", value("filter-q"));
      if (path === "admin/users")
        p.set("access", value("filter-access") || "all");
      if (path === "admin/tickets")
        p.set("status", value("filter-status") || "all");
      nav(path + "?" + p.toString());
      return;
    }
    if (action === "reload" || action === "retry") {
      if (
        root.querySelector("#site-form") ||
        value("reply-body") ||
        value("ticket-body")
      ) {
        if (
          !(await confirmDialog(
            "Recharger la page et abandonner les champs non envoyés ?",
          ))
        )
          return;
      }
      show(loading);
      retry();
      return;
    }
    if (
      action === "close-ticket" &&
      !(await confirmDialog(
        "Fermer cette demande ? Elle pourra être rouverte.",
      ))
    )
      return;
    pending = true;
    el.setAttribute("disabled", "");
    root.setAttribute("aria-busy", "true");
    const err = root.querySelector("#hub-error");
    if (err) err.textContent = "";
    try {
      if (action === "send-ticket") {
        if (!valid(["ticket-subject", "ticket-body"])) return;
        const subject = value("ticket-subject"),
          body = value("ticket-body");
        if (subject.length < 4 || body.length < 10)
          throw new Error(
            "Renseignez un objet d’au moins 4 caractères et un message d’au moins 10 caractères.",
          );
        const d = await request("/support/tickets", "POST", {
          id: requestId,
          subject,
          category: value("ticket-category"),
          body,
        });
        if (alive()) nav("tickets/" + d.id);
      } else if (action === "send-reply") {
        if (!valid(["reply-body"])) return;
        const body = value("reply-body");
        if (body.length < 2)
          throw new Error("Écrivez au moins deux caractères.");
        await request(
          `/support/tickets/${encodeURIComponent(path.split("/").at(-1)!)}/messages`,
          "POST",
          { id: requestId, body },
        );
        requestId = crypto.randomUUID();
        if (alive()) {
          const input = root.querySelector(
            "#reply-body",
          ) as HTMLInputElement | null;
          if (input) input.value = "";
          await load();
          const slot = root.querySelector("#hub-status");
          if (slot) slot.textContent = "Votre message a été enregistré.";
        }
      } else if (action === "close-ticket" || action === "reopen") {
        await request(
          `/support/tickets/${encodeURIComponent(path.split("/").at(-1)!)}`,
          "PATCH",
          { status: action === "reopen" ? "open" : "closed" },
        );
        if (alive()) await load();
      } else if (action === "save-site") {
        if (!valid(["site-email"])) return;
        const version = Number(
          (root.querySelector("#site-form") as HTMLElement).dataset.version,
        );
        const site = await request("/admin/site", "PUT", {
          publisher: value("site-publisher"),
          country: value("site-country"),
          address: value("site-address"),
          email: value("site-email"),
          registration: value("site-registration"),
          version,
        });
        if (alive()) {
          (root.querySelector("#site-form") as HTMLElement).dataset.version =
            String(site.version);
          root.querySelector("#hub-status")!.textContent =
            "Les informations publiques ont été enregistrées.";
        }
      } else if (action === "export") {
        const data = await request("/support/export");
        if (alive()) {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "mes-conversations-support.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          root.querySelector("#hub-status")!.textContent =
            "Export préparé. Conservez ce fichier privé en lieu sûr.";
        }
      }
    } catch (err) {
      fail(err);
    } finally {
      pending = false;
      if (alive()) {
        el.removeAttribute("disabled");
        root.removeAttribute("aria-busy");
      }
    }
  }
  const click = (event: Event) => {
    const el = event
      .composedPath()
      .find((n) => n instanceof HTMLElement && n.dataset.hub) as
      HTMLElement | undefined;
    if (!el || !root.contains(el)) return;
    event.preventDefault();
    void act(el.dataset.hub!, el);
  };
  const input = (event: Event) => {
    if ((event.target as HTMLElement).id === "faq-search")
      root.querySelector("#faq-results")!.innerHTML = faqList(
        value("faq-search"),
      );
  };
  const submit = (event: Event) => {
    event.preventDefault();
    const f = event.target as HTMLElement;
    const b = f.querySelector<HTMLElement>("[data-hub]");
    if (b) void act(b.dataset.hub!, b);
  };
  root.addEventListener("click", click);
  root.addEventListener("input", input);
  root.addEventListener("submit", submit);
  void load();
  return () => {
    dismissConfirm?.();
    controller.abort();
    root.removeEventListener("click", click);
    root.removeEventListener("input", input);
    root.removeEventListener("submit", submit);
  };
}
