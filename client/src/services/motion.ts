import { animate } from "motion/mini";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const revealSelector =
  ".method-card, .benefits-list article, .quick-card, .journey, .practice-card, .pricing-offer, .pricing-form-card, .payment-confirmed, .notes-grid > *, .list > *, .closing-cta, .faq-list details, .hub-panel, .metric-card, .thread-message";
const hoverSelector =
  ".quick-card, .method-card, .practice-card, .pricing-offer, .metric-card";

// Progressive enhancement only. Content is never hidden waiting for JS or an observer.
// No cloned screens (especially not account/payment forms), no scroll hijacking.
export function initSiteMotion(root: HTMLElement): () => void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const cleanups = new Set<() => void>();
  let observer: IntersectionObserver | undefined;
  let lastRoute = "",
    frame = 0,
    pointerFrame = 0;
  let hovered: HTMLElement | null = null;
  let pointer: { x: number; y: number; card: HTMLElement } | null = null;
  let disposed = false;

  function enabled() {
    return !reduce.matches && !document.hidden;
  }
  function enter(
    el: HTMLElement,
    delay = 0,
    backward = false,
    duration = 0.55,
  ) {
    if (!enabled() || !el.isConnected) return;
    const original = {
      opacity: el.style.opacity,
      transform: el.style.transform,
    };
    let control: ReturnType<typeof animate>;
    try {
      control = animate(
        el,
        {
          opacity: [0, 1],
          transform: [
            backward ? "translate3d(-18px,0,0)" : "translate3d(0,22px,0)",
            "none",
          ],
        },
        { duration, delay, ease },
      );
    } catch {
      return;
    } // Motion/WAAPI is optional; a failed animation must not break a form.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      control.cancel();
      el.style.opacity = original.opacity;
      el.style.transform = original.transform;
      cleanups.delete(finish);
    };
    cleanups.add(finish);
    void control.finished.then(finish, finish);
  }
  function clearView() {
    observer?.disconnect();
    observer = undefined;
    for (const finish of [...cleanups]) finish();
    resetPointer();
  }
  function resetPointer() {
    if (hovered) {
      for (const key of ["--pointer-x", "--pointer-y", "--tilt-x", "--tilt-y"])
        hovered.style.removeProperty(key);
      hovered = null;
    }
    pointer = null;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
  }
  function decorate() {
    // Standard Material ripple for plain links/buttons; native Material components
    // already implement their own ripple. No extra interactive elements are added.
    root
      .querySelectorAll<HTMLElement>(
        ".wordmark, .marketing-nav a, .login-link, .method-link, .text-arrow, .public-footer a, .public-footer button, .footer a, .footer button, .privacy-text-link, .faq-list summary, .hub-link, .hub-tabs a, .ticket-row, .metric-card",
      )
      .forEach((el) => {
        el.classList.add("motion-tap");
        if (!el.querySelector(":scope > md-ripple")) {
          const ripple = document.createElement("md-ripple");
          ripple.setAttribute("aria-hidden", "true");
          el.append(ripple);
        }
      });
  }
  function mount() {
    if (disposed) return;
    clearView();
    decorate();
    updateHeader();
    document.documentElement.dataset.siteMotion = reduce.matches
      ? "reduced"
      : "full";
    const route = (location.hash || "#welcome").split("/")[0];
    const changed = route !== lastRoute;
    lastRoute = route;
    if (!enabled()) return;
    if (changed) {
      const header = root.querySelector<HTMLElement>(".public-header,.appbar");
      if (header) enter(header, 0, false, 0.42);
      const page = root.querySelector<HTMLElement>("#main-content");
      const backward =
        page?.classList.contains("back") || root.dataset.direction === "back";
      const leads = root.querySelectorAll<HTMLElement>(
        ".landing-copy > *, .landing-visual, .auth-editorial > :not(.auth-editorial-art), .auth-card, .page-title, .welcome, .hero, .payment-heading, .payment-gate, .hub-heading, .admin-context",
      );
      leads.forEach((el, i) =>
        enter(el, Math.min(i, 6) * 0.065, backward, 0.6),
      );
      if (leads.length === 0 && page) enter(page, 0, backward, 0.4);
    }
    const items = [...root.querySelectorAll<HTMLElement>(revealSelector)];
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          let i = 0;
          for (const entry of entries) {
            if (entry.isIntersecting) {
              observer?.unobserve(entry.target);
              enter(
                entry.target as HTMLElement,
                Math.min(i++, 4) * 0.065,
                false,
                0.55,
              );
            }
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
      );
      items.forEach((el) => observer!.observe(el));
    } // Without IntersectionObserver all content remains visible.
  }
  function updateHeader() {
    const y = Math.max(0, window.scrollY || document.documentElement.scrollTop);
    const total = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    root
      .querySelectorAll<HTMLElement>(".public-header,.appbar")
      .forEach((el) => {
        el.classList.toggle("is-scrolled", y > 16);
        el.style.setProperty(
          "--page-progress",
          String(total ? Math.min(1, y / total) : 0),
        );
      });
  }
  function scroll() {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateHeader();
      });
  }
  function move(event: PointerEvent) {
    if (!enabled() || !finePointer.matches || event.pointerType === "touch")
      return;
    const card =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(hoverSelector)
        : null;
    if (!card) {
      resetPointer();
      return;
    }
    if (hovered !== card) {
      resetPointer();
      hovered = card;
    }
    pointer = { x: event.clientX, y: event.clientY, card };
    if (!pointerFrame)
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pointer) return;
        const { x, y, card } = pointer,
          rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const px = Math.max(0, Math.min(1, (x - rect.left) / rect.width)),
          py = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
        card.style.setProperty("--pointer-x", `${px * 100}%`);
        card.style.setProperty("--pointer-y", `${py * 100}%`);
        card.style.setProperty("--tilt-x", `${(py - 0.5) * -2}deg`);
        card.style.setProperty("--tilt-y", `${(px - 0.5) * 2}deg`);
      });
  }
  function toggle(event: Event) {
    const details = event.target;
    if (details instanceof HTMLDetailsElement && details.open) {
      const answer = details.querySelector<HTMLElement>("p");
      if (answer) enter(answer, 0, false, 0.25);
    }
  }
  function visibility() {
    if (document.hidden) {
      clearView();
    } else {
      mount();
    }
  }
  const viewReady = () => {
    lastRoute = "";
    mount();
  };
  root.addEventListener("prep:view-ready", viewReady);
  const mutation = new MutationObserver(mount);
  mutation.observe(root, { childList: true });
  root.addEventListener("pointermove", move, { passive: true });
  root.addEventListener("pointerleave", resetPointer);
  root.addEventListener("toggle", toggle, true);
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("resize", scroll, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  reduce.addEventListener("change", mount);
  mount();
  return () => {
    disposed = true;
    mutation.disconnect();
    root.removeEventListener("prep:view-ready", viewReady);
    clearView();
    cancelAnimationFrame(frame);
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerleave", resetPointer);
    root.removeEventListener("toggle", toggle, true);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("resize", scroll);
    document.removeEventListener("visibilitychange", visibility);
    reduce.removeEventListener("change", mount);
    delete document.documentElement.dataset.siteMotion;
  };
}
