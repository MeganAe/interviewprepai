import "@material/web/textfield/filled-text-field.js";
import {
  CheckoutError,
  getOffer,
  initiateCheckout,
  validateCustomer,
  type CheckoutCustomer,
  type PaymentStatus,
} from "../services/checkout";
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (name: string) =>
  `<span class="icon" aria-hidden="true">${name}</span>`;
type User = { name: string; email: string };
export function pricingPage(user: User | null, status: PaymentStatus | null) {
  if (status?.is_paid)
    return `<section class="payment-page"><div class="payment-heading"><div class="eyebrow">VOTRE ACCÈS</div><h1>Votre préparation est activée.</h1><p>Vous pouvez analyser vos CV et préparer vos entretiens.</p></div><div class="payment-confirmed">${icon("verified")}<h2>Accès actif</h2>${status.paid_at ? `<p>Activé le ${esc(new Date(status.paid_at).toLocaleDateString("fr-FR"))}.</p>` : ""}<md-filled-button data-act="go-home">Retrouver mon espace</md-filled-button></div></section>`;
  const names = user?.name.trim().split(/\s+/) ?? [];
  return `<section class="payment-page" id="pricing-page"><div class="payment-heading"><div class="eyebrow">ACCÈS À LA PRÉPARATION</div><h1>Préparez vos entretiens.<br>Un seul paiement.</h1><p>Activez l’analyse des CV, les sessions personnalisées et leurs bilans.</p></div><div class="pricing-layout"><aside class="pricing-offer"><div class="eyebrow">INTERVIEW PREP AI</div><h2>Votre accès complet</h2><div class="offer-price" id="offer-price" aria-live="polite"><md-circular-progress indeterminate aria-label="Chargement du tarif"></md-circular-progress></div><p class="offer-frequency" id="offer-frequency">Paiement unique · sans abonnement</p><ul class="offer-benefits">${[
    ["description", "Analyse de vos CV PDF"],
    ["forum", "Entretiens de 5 ou 8 questions"],
    ["task_alt", "Score et conseils pour chaque réponse"],
    ["history", "Historique de vos préparations"],
  ]
    .map(([i, t]) => `<li>${icon(i)}<span>${t}</span></li>`)
    .join(
      "",
    )}</ul><p class="offer-disclaimer">Le montant définitif est confirmé sur la page de paiement. Les moyens de paiement disponibles dépendent de votre pays.</p><div id="offer-error" class="form-error" role="alert"></div><md-text-button data-payment="retry-offer" hidden>Recharger le tarif</md-text-button></aside><div class="pricing-form-card"><h2>${user ? "Vos coordonnées" : "Commencez par votre compte"}</h2><p>${user ? "Ces informations seront transmises au prestataire de paiement. Aucun numéro de carte n’est demandé ici." : "Connectez-vous ou créez un compte pour que votre paiement active le bon espace personnel."}</p>${user ? `<form id="checkout-form" novalidate><div class="payment-field-row"><md-filled-text-field id="checkout-first" label="Prénom" required maxlength="50" autocomplete="given-name" value="${esc(names[0])}"></md-filled-text-field><md-filled-text-field id="checkout-last" label="Nom" required maxlength="50" autocomplete="family-name" value="${esc(names.slice(1).join(" "))}"></md-filled-text-field></div><md-filled-text-field id="checkout-email" label="E-mail du compte" type="email" required readonly autocomplete="email" value="${esc(user.email)}" supporting-text="Le paiement est lié à votre compte, pas uniquement à cette adresse."></md-filled-text-field><div class="payment-field-row"><md-filled-text-field id="checkout-country" label="Code pays" placeholder="FR, CI, SN…" required maxlength="2" autocomplete="country" supporting-text="Deux lettres (ISO)."></md-filled-text-field><md-filled-text-field id="checkout-phone" label="Téléphone national" type="tel" required maxlength="25" autocomplete="tel-national" supporting-text="Sans indicatif international."></md-filled-text-field></div><div id="checkout-error" class="form-error" role="alert"></div><md-filled-button type="button" class="full" data-payment="submit" disabled><md-icon slot="icon">${icon("lock")}</md-icon>Continuer vers le paiement</md-filled-button><p class="payment-safety">Vous serez redirigé vers une page de paiement sécurisée. L’accès sera activé après confirmation du paiement par notre serveur.</p></form>` : `<div class="payment-auth-actions"><md-filled-button data-payment="login">Se connecter pour continuer</md-filled-button><md-outlined-button data-payment="register">Créer un compte</md-outlined-button></div>`}<button class="privacy-text-link" data-act="privacy"><md-ripple></md-ripple>Confidentialité et traitement des données ${icon("north_east")}</button></div></div></section>`;
}
export function mountPricing(
  root: HTMLElement,
  options: {
    user: User | null;
    onAuth: (mode: "login" | "register") => void;
    onCompleted: (step: string) => Promise<void>;
    redirect: (url: string) => void;
    onError: (error: unknown) => void;
  },
): () => void {
  const controller = new AbortController();
  let available = false,
    busy = false;
  const price = root.querySelector<HTMLElement>("#offer-price")!;
  const error = root.querySelector<HTMLElement>("#offer-error")!;
  const submit = root.querySelector<HTMLElement>('[data-payment="submit"]');
  const retry = root.querySelector<HTMLElement>(
    '[data-payment="retry-offer"]',
  )!;
  const alive = () => root.isConnected && !controller.signal.aborted;
  async function load() {
    available = false;
    submit?.setAttribute("disabled", "");
    error.textContent = "";
    retry.hidden = true;
    try {
      const offer = await getOffer(controller.signal);
      if (!alive()) return;
      price.textContent = offer.price.formatted;
      available = true;
      submit?.removeAttribute("disabled");
      if (offer.price.value === 0) {
        root.querySelector("#offer-frequency")!.textContent =
          "Accès sans frais — confirmation requise";
        if (submit) submit.textContent = "Activer mon accès";
      }
    } catch (e) {
      if (!alive()) return;
      price.textContent = "Tarif indisponible";
      error.textContent =
        e instanceof Error ? e.message : "Impossible de charger le tarif.";
      retry.hidden = false;
    }
  }
  const val = (id: string) =>
    String((root.querySelector("#" + id) as any)?.value ?? "").trim();
  async function pay() {
    if (busy || !available || !options.user) return;
    const customer: CheckoutCustomer = {
      firstName: val("checkout-first"),
      lastName: val("checkout-last"),
      email: val("checkout-email"),
      phone: val("checkout-phone"),
      countryCode: val("checkout-country").toUpperCase(),
    };
    const target = root.querySelector<HTMLElement>("#checkout-error")!;
    const validation = validateCustomer(customer);
    target.textContent = validation ?? "";
    if (validation) return;
    busy = true;
    submit!.setAttribute("disabled", "");
    const old = submit!.innerHTML;
    submit!.innerHTML =
      '<md-circular-progress slot="icon" indeterminate aria-label="Chargement"></md-circular-progress>Préparation du paiement…';
    try {
      const checkout = await initiateCheckout(customer, controller.signal);
      if (!alive()) return;
      if (checkout.step === "payment") {
        options.redirect(checkout.checkout_url!);
      } else {
        await options.onCompleted(checkout.step);
      }
    } catch (e) {
      if (!alive()) return;
      target.textContent =
        e instanceof Error ? e.message : "Le paiement n’a pas pu être préparé.";
      if (e instanceof CheckoutError && e.status === 401) options.onError(e);
    } finally {
      busy = false;
      if (alive()) {
        submit!.removeAttribute("disabled");
        submit!.innerHTML = old;
      }
    }
  }
  const click = (event: Event) => {
    const el = event
      .composedPath()
      .find(
        (n) => n instanceof HTMLElement && n.hasAttribute("data-payment"),
      ) as HTMLElement | undefined;
    if (!el) return;
    event.preventDefault();
    switch (el.dataset.payment) {
      case "retry-offer":
        void load();
        break;
      case "submit":
        void pay();
        break;
      case "login":
        options.onAuth("login");
        break;
      case "register":
        options.onAuth("register");
        break;
    }
  };
  const formSubmit = (event: Event) => {
    event.preventDefault();
    void pay();
  };
  root.addEventListener("click", click);
  root.querySelector("form")?.addEventListener("submit", formSubmit);
  void load();
  return () => {
    controller.abort();
    root.removeEventListener("click", click);
    root.querySelector("form")?.removeEventListener("submit", formSubmit);
  };
}
