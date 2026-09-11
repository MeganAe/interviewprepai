import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("idb-keyval", () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
}));
const user = {
  id: "payment-test-account",
  name: "Compte Test",
  email: "compte@example.test",
};
let signedIn = false,
  paid = false,
  statusError = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fetch = vi.fn(async (path: string, options: RequestInit = {}) => {
  if (path === "/api/me") return signedIn ? json(user) : json({}, 401);
  if (path === "/api/auth/login") {
    signedIn = true;
    return json(user);
  }
  if (path === "/api/checkout/status")
    return statusError
      ? json({ error: "Service indisponible." }, 503)
      : signedIn
        ? json({ is_paid: paid, paid_at: paid ? "2026-09-08T12:00:00Z" : null })
        : json({}, 401);
  if (path === "/api/checkout/offer")
    return json({
      product_id: "prd_test",
      name: "Accès test",
      price: { value: 29, formatted: "29 €", currency: "EUR" },
      billing: "one_time",
    });
  if (path === "/api/checkout" && options.method === "POST")
    return json({ data: { step: "completed", payment: null } });
  if (path === "/api/data" || path === "/api/account/export")
    return json({ cvs: [], sessions: [] });
  throw new Error("Unexpected test request " + path);
});
const pause = () => new Promise((r) => setTimeout(r, 30));
async function hash(route: string) {
  history.pushState({}, "", `#${route}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await pause();
}
async function click(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  expect(el, selector).not.toBeNull();
  el!.click();
  await pause();
}
async function field(id: string, value: string) {
  const el = document.getElementById(id) as any;
  expect(el, id).not.toBeNull();
  await el.updateComplete;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
}
beforeAll(async () => {
  vi.stubGlobal("fetch", fetch);
  history.replaceState({}, "", "#pricing");
  document.body.innerHTML =
    '<div id="app"></div><div id="modal-root"></div><div id="toast" role="status"></div>';
  await import("../src/main");
  await pause();
});
describe.sequential(
  "Real router and server-authoritative paywall (DOM only)",
  () => {
    it("allows anonymous pricing without fetching protected account data", () => {
      expect(location.hash).toBe("#pricing");
      expect(document.querySelector("#pricing-page")).not.toBeNull();
      expect(document.querySelector('[data-payment="login"]')).not.toBeNull();
      expect(fetch.mock.calls.some(([path]) => path === "/api/data")).toBe(
        false,
      );
    });
    it("returns an unpaid login to pricing instead of failing on /api/data", async () => {
      await click('[data-payment="login"]');
      expect(location.hash).toBe("#login");
      await field("auth-email", user.email);
      await field("auth-password", "valid-test-password");
      await click('[data-act="submit-login"]');
      await vi.waitFor(() => expect(location.hash).toBe("#pricing"));
      expect(document.querySelector("#checkout-form")).not.toBeNull();
      expect(fetch.mock.calls.some(([path]) => path === "/api/data")).toBe(
        false,
      );
    });
    it("offers access links in desktop and mobile navigation", () => {
      expect(
        document.querySelector('.sidebar a[href="#pricing"]'),
      ).not.toBeNull();
      expect(
        document.querySelector('.bottom-nav a[href="#pricing"]'),
      ).not.toBeNull();
    });
    it.each([
      "cv",
      "cv/some-id",
      "practice",
      "history",
      "session/some-id",
      "results/some-id",
      "interview",
      "analyse",
    ])("guards direct #%s routes", async (route) => {
      await hash(route);
      await vi.waitFor(() => expect(location.hash).toBe("#pricing"));
      expect(document.querySelector("#checkout-form")).not.toBeNull();
    });
    it("guards upload actions on the unpaid home screen", async () => {
      await hash("home");
      expect(document.querySelector(".access-banner")).not.toBeNull();
      await click('.hero [data-act="upload"]');
      await vi.waitFor(() => expect(location.hash).toBe("#pricing"));
      expect(document.querySelector("md-dialog")).toBeNull();
    });
    it("keeps access blocked when its status cannot be verified", async () => {
      statusError = true;
      await hash("practice");
      expect(document.querySelector(".payment-gate")!.textContent).toContain(
        "Accès non vérifié",
      );
      expect(document.querySelector(".practice-card")).toBeNull();
      statusError = false;
      await click('[data-act="retry-payment"]');
      expect(location.hash).toBe("#pricing");
    });
    it("returns completed checkout to home but does not fabricate an active entitlement", async () => {
      for (const [id, value] of Object.entries({
        "checkout-first": "Compte",
        "checkout-last": "Test",
        "checkout-email": user.email,
        "checkout-country": "FR",
        "checkout-phone": "0612345678",
      }))
        await field(id, value);
      await click('[data-payment="submit"]');
      await vi.waitFor(() => expect(location.hash).toBe("#home"));
      expect(document.querySelector(".access-banner")).not.toBeNull();
      expect(fetch.mock.calls.some(([path]) => path === "/api/data")).toBe(
        false,
      );
    });
    it("keeps merci pending until PostgreSQL status confirms, then enables the workspace", async () => {
      await click('[data-act="go-merci"]');
      expect(location.hash).toBe("#merci");
      expect(document.querySelector("#merci-title")!.textContent).toContain(
        "attendons",
      );
      paid = true;
      await click('[data-payment="retry-status"]');
      await vi.waitFor(() =>
        expect(document.querySelector("#merci-title")!.textContent).toContain(
          "accès est actif",
        ),
      );
      expect(
        document.querySelector('.bottom-nav a[href="#pricing"]'),
      ).toBeNull();
      await click("#merci-home");
      expect(location.hash).toBe("#home");
      expect(document.querySelector(".access-banner")).toBeNull();
      await hash("practice");
      expect(document.querySelector(".practice-card")).not.toBeNull();
    });
  },
);
