import {
  checkPaymentStatus,
  CheckoutError,
  type PaymentStatus,
} from "../services/checkout";
export function merciPage(status: PaymentStatus | null) {
  const paid = status?.is_paid === true;
  return `<section class="payment-page merci-page" id="merci-page"><div class="payment-confirmed"><div class="merci-symbol"><span class="icon" aria-hidden="true">${paid ? "task_alt" : "schedule"}</span></div><div class="eyebrow">${paid ? "PAIEMENT CONFIRMÉ" : "VÉRIFICATION DU PAIEMENT"}</div><h1 id="merci-title">${paid ? "Merci. Votre accès est actif." : "Nous attendons la confirmation."}</h1><p id="merci-message" role="status" aria-live="polite">${paid ? "Vous pouvez maintenant analyser votre CV et commencer un entretien." : "La page de paiement a terminé sa redirection. Nous vérifions la confirmation reçue par notre serveur. Ne payez pas une seconde fois."}</p><div id="merci-progress">${paid ? "" : '<md-circular-progress indeterminate aria-label="Vérification en cours"></md-circular-progress>'}</div><div id="merci-error" class="form-error" role="alert"></div><div class="merci-actions"><md-filled-button data-act="go-home" ${paid ? "" : "disabled"} id="merci-home">Aller à mon espace</md-filled-button><md-outlined-button data-payment="retry-status" id="merci-retry" ${paid ? "hidden" : ""}>Vérifier à nouveau</md-outlined-button></div><p class="payment-safety">L’ouverture de cette page ne valide pas un achat. Seule la confirmation enregistrée sur votre compte active l’accès.</p></div></section>`;
}
export function mountMerci(
  root: HTMLElement,
  status: PaymentStatus | null,
  options: { onConfirmed: (status: PaymentStatus) => void; onAuth: () => void },
): () => void {
  const controller = new AbortController();
  let timer = 0,
    attempts = 0,
    running = false,
    confirmed = status?.is_paid === true;
  const alive = () => root.isConnected && !controller.signal.aborted;
  async function poll() {
    if (running || confirmed || !alive()) return;
    running = true;
    attempts++;
    try {
      const result = await checkPaymentStatus(controller.signal);
      if (!alive()) return;
      root.querySelector("#merci-error")!.textContent = "";
      if (result.is_paid) {
        confirmed = true;
        root.querySelector("#merci-title")!.textContent =
          "Merci. Votre accès est actif.";
        root.querySelector("#merci-message")!.textContent =
          "Vous pouvez maintenant analyser votre CV et commencer un entretien.";
        root.querySelector("#merci-progress")!.innerHTML = "";
        root.querySelector("#merci-home")!.removeAttribute("disabled");
        root.querySelector("#merci-retry")!.setAttribute("hidden", "");
        root.querySelector(".merci-symbol .icon")!.textContent = "task_alt";
        root.querySelector(".eyebrow")!.textContent = "PAIEMENT CONFIRMÉ";
        options.onConfirmed(result);
        return;
      }
      if (attempts >= 20) {
        root.querySelector("#merci-progress")!.innerHTML = "";
        root.querySelector("#merci-message")!.textContent =
          "La confirmation n’est pas encore arrivée. Vérifiez à nouveau dans quelques minutes. Si le paiement a été débité, contactez l’assistance sans effectuer un nouvel achat.";
      }
    } catch (e) {
      if (!alive()) return;
      root.querySelector("#merci-error")!.textContent =
        e instanceof Error ? e.message : "Vérification indisponible.";
      if (e instanceof CheckoutError && e.status === 401) {
        options.onAuth();
        return;
      }
    } finally {
      running = false;
      if (alive() && !confirmed && attempts < 20)
        timer = window.setTimeout(() => void poll(), 3000);
    }
  }
  const click = (e: Event) => {
    const el = e
      .composedPath()
      .find(
        (n) => n instanceof HTMLElement && n.dataset.payment === "retry-status",
      );
    if (!el) return;
    e.preventDefault();
    if (running) return;
    clearTimeout(timer);
    attempts = 0;
    root.querySelector("#merci-progress")!.innerHTML =
      '<md-circular-progress indeterminate aria-label="Vérification"></md-circular-progress>';
    void poll();
  };
  root.addEventListener("click", click);
  if (!confirmed) void poll();
  return () => {
    controller.abort();
    clearTimeout(timer);
    root.removeEventListener("click", click);
  };
}
