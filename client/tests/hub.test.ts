import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/dialog/dialog.js";
import "@material/web/progress/circular-progress.js";
import {
  mountHub,
  hubPage,
  isHubRoute,
  escapeHtml,
  publicHubRoutes,
} from "../src/pages/hub";
import { wordmark } from "../src/brand";
import { hasAccess, checkPaymentStatus } from "../src/services/checkout";
import { pricingPage } from "../src/pages/pricing";
import { readFileSync } from "node:fs";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Compte test",
  email: "user@example.test",
};
const admin = { ...user, is_admin: true };
const ticketId = "22222222-2222-4222-8222-222222222222";
const ticket = {
  id: ticketId,
  subject: "Problème de test",
  category: "technical",
  status: "open",
  created_at: "2026-09-11T10:00:00Z",
  updated_at: "2026-09-11T10:00:00Z",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const blank = {
  publisher: "",
  country: "",
  address: "",
  email: "",
  registration: "",
  version: 0,
};
let root: HTMLElement,
  dispose = () => {},
  fetcher: ReturnType<typeof vi.fn>;
const nav = vi.fn(),
  expired = vi.fn();
const start = (route: string, u: typeof user | null = user) => {
  dispose = mountHub(root, route, u, nav, expired);
};
const loaded = async (selector = "h1") =>
  vi.waitFor(() => expect(root.querySelector(selector)).not.toBeNull());
const field = async (id: string, value: string) => {
  const el = root.querySelector(`#${id}`) as any;
  expect(el, id).not.toBeNull();
  el.value = value;
  await el.updateComplete;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const click = (act: string) =>
  (root.querySelector(`[data-hub="${act}"]`) as HTMLElement).click();
beforeEach(() => {
  document.body.innerHTML = hubPage();
  root = document.querySelector("#hub-root")!;
  nav.mockClear();
  expired.mockClear();
  fetcher = vi.fn(async () => json(blank));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  dispose();
  dispose = () => {};
  vi.unstubAllGlobals();
});
describe("Real page contracts (DOM only)", () => {
  it("is text-only everywhere, with no symbol or AI badge", () => {
    root.innerHTML = wordmark();
    expect(root.textContent).toBe("Interview Prep AI");
    expect(
      root.querySelector("svg,.wordmark-ai,.brand-symbol,.badge"),
    ).toBeNull();
    expect(root.querySelector("a")!.getAttribute("href")).toBe("#welcome");
  });
  it("recognizes public, private, query and detail routes", () => {
    for (const r of [
      ...publicHubRoutes,
      "tickets",
      "tickets? page=2",
      "tickets/id",
      "admin",
      "admin/users?q=x",
      "admin/tickets/id",
    ])
      expect(isHubRoute(r)).toBe(true);
    expect(isHubRoute("administrator")).toBe(false);
    expect(isHubRoute("practice")).toBe(false);
  });
  it("searches help locally without a paywall request", async () => {
    start("support", null);
    await loaded();
    await field("faq-search", "PDF");
    expect(root.querySelector("#faq-results")!.textContent).toContain("PDF");
    await field("faq-search", "qwerty-unmatched");
    expect(root.textContent).toContain("Aucune réponse trouvée");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("offers a login route rather than an anonymous ticket submission", async () => {
    start("contact", null);
    await loaded();
    expect(root.querySelector("#ticket-form")).toBeNull();
    expect(root.querySelector('a[href="#tickets"]')).not.toBeNull();
    expect(root.textContent).toContain("Aucun paiement");
  });
  it("allows unpaid users to send a real ticket, without client ownership fields", async () => {
    fetcher.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith("/site") ? json(blank) : json({ id: ticketId }),
    );
    start("contact");
    await loaded("#ticket-subject");
    await field("ticket-subject", "Objet du test");
    await field("ticket-body", "Message de test privé suffisamment long.");
    await field("ticket-category", "technical");
    click("send-ticket");
    await vi.waitFor(() =>
      expect(nav).toHaveBeenCalledWith("tickets/" + ticketId),
    );
    const call = fetcher.mock.calls.find((c) => c[1]?.method === "POST")!;
    expect(call[0]).toBe("/api/support/tickets");
    expect(call[1].credentials).toBe("same-origin");
    expect(call[1].headers["X-Requested-With"]).toBe("InterviewPrep");
    const body = JSON.parse(call[1].body);
    expect(body).not.toHaveProperty("user_id");
    expect(body).not.toHaveProperty("from_admin");
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("validates contact fields before posting", async () => {
    start("contact");
    await loaded("#ticket-body");
    click("send-ticket");
    await Promise.resolve();
    expect(fetcher.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false);
  });
  it("preserves message content and reuses its idempotency key after an error", async () => {
    const ids: string[] = [];
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        ids.push(JSON.parse(init.body as string).id);
        return json({ error: "Échec de test" }, 503);
      }
      return json(blank);
    });
    start("contact");
    await loaded("#ticket-body");
    await field("ticket-subject", "Objet de test");
    await field("ticket-body", "Le texte ne doit pas être perdu.");
    click("send-ticket");
    await vi.waitFor(() =>
      expect(root.querySelector("#hub-error")!.textContent).toContain("Échec"),
    );
    expect((root.querySelector("#ticket-body") as any).value).toContain(
      "pas être perdu",
    );
    click("send-ticket");
    await vi.waitFor(() => expect(ids).toHaveLength(2));
    expect(ids[0]).toBe(ids[1]);
  });
  it("renders a truthful empty inbox", async () => {
    fetcher.mockResolvedValue(
      json({ items: [], total: 0, page: 1, page_size: 20 }),
    );
    start("tickets");
    await loaded();
    expect(root.textContent).toContain("Aucune demande");
    expect(root.querySelectorAll(".ticket-row")).toHaveLength(0);
    expect(
      root.querySelector('[data-hub="next"]')!.hasAttribute("disabled"),
    ).toBe(true);
  });
  it("blocks admin UI for ordinary users without fetching protected data", async () => {
    start("admin", user);
    await loaded();
    expect(root.textContent).toContain("Administration réservée");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("renders server counts and a distinct free admin access notice", async () => {
    fetcher.mockResolvedValue(
      json({
        users: 3,
        paid_users: 1,
        receipts: 1,
        open_tickets: 2,
        waiting_tickets: 0,
        closed_tickets: 0,
        cvs: 4,
        sessions: 5,
        as_of: "2026-09-11T12:00:00Z",
      }),
    );
    start("admin", admin);
    await loaded();
    expect(
      [...root.querySelectorAll(".metric-card strong")].map(
        (e) => e.textContent,
      ),
    ).toEqual(["3", "1", "2", "1"]);
    expect(root.textContent).toContain("accès gratuit");
    expect(root.textContent).toContain("Aucun chiffre d’affaires");
  });
  it("handles server denial even if the client admin flag is stale", async () => {
    fetcher.mockResolvedValue(json({ error: "Accès retiré" }, 403));
    start("admin", admin);
    await loaded();
    expect(root.textContent).toContain("Accès réservé");
    expect(root.querySelector(".metric-grid")).toBeNull();
  });
  it("does not render personal results after disposal of an asynchronous page", async () => {
    let finish!: (v: Response) => void;
    fetcher.mockImplementation(() => new Promise((r) => (finish = r)));
    start("admin/users", admin);
    dispose();
    root.innerHTML = "Nouvelle page";
    finish(
      json({
        items: [{ name: "Secret", email: "private@example.test" }],
        total: 1,
      }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(root.textContent).toBe("Nouvelle page");
  });
  it("escapes support message bodies instead of executing user markup", async () => {
    fetcher.mockResolvedValue(
      json({
        ticket,
        messages: [
          {
            body: '<img src=x onerror="evil()">',
            from_admin: false,
            created_at: ticket.created_at,
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      }),
    );
    start("tickets/" + ticketId);
    await loaded(".thread-message");
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector(".thread-message p")!.textContent).toContain(
      "<img",
    );
    expect(escapeHtml('<a href="x">')).toBe("&lt;a href=&quot;x&quot;&gt;");
  });
  it("writes replies then reloads the persisted conversation", async () => {
    let sent = false;
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        sent = true;
        return json({ id: ticketId });
      }
      return json({
        ticket,
        messages: sent
          ? [
              {
                body: "Une réponse de test",
                from_admin: true,
                created_at: ticket.created_at,
              },
            ]
          : [],
        total: sent ? 1 : 0,
        page: 1,
        page_size: 50,
      });
    });
    start("admin/tickets/" + ticketId, admin);
    await loaded("#reply-body");
    await field("reply-body", "Une réponse de test");
    click("send-reply");
    await vi.waitFor(() =>
      expect(root.querySelector(".thread-message p")?.textContent).toBe(
        "Une réponse de test",
      ),
    );
    expect(root.querySelector("#hub-status")!.textContent).toContain(
      "enregistré",
    );
  });
  it("renders legal pages without invented publisher information", async () => {
    start("legal", null);
    await loaded();
    expect(root.textContent).toContain("Non renseigné");
    expect(root.textContent).toContain("incomplètes");
    expect(root.textContent).toContain("Render");
  });
  it("publishes editor details with version concurrency control", async () => {
    fetcher.mockImplementation(async (url: string, init?: RequestInit) =>
      json(init?.method === "PUT" ? { ...blank, version: 1 } : blank),
    );
    start("admin/site", admin);
    await loaded("#site-form");
    await field("site-publisher", "Éditeur de test");
    click("save-site");
    await vi.waitFor(() =>
      expect(root.querySelector("#hub-status")!.textContent).toContain(
        "enregistrées",
      ),
    );
    const call = fetcher.mock.calls.find((c) => c[1]?.method === "PUT")!;
    expect(call[0]).toBe("/api/admin/site");
    expect(JSON.parse(call[1].body)).toMatchObject({
      publisher: "Éditeur de test",
      version: 0,
    });
    expect(
      (root.querySelector("#site-form") as HTMLElement).dataset.version,
    ).toBe("1");
  });
  it("keeps unpublished settings on a conflict instead of claiming success", async () => {
    fetcher.mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? json({ error: "Modifié dans un autre onglet" }, 409)
        : json(blank),
    );
    start("admin/site", admin);
    await loaded("#site-form");
    await field("site-publisher", "Mon brouillon");
    click("save-site");
    await vi.waitFor(() =>
      expect(root.querySelector("#hub-error")!.textContent).toContain(
        "autre onglet",
      ),
    );
    expect((root.querySelector("#site-publisher") as any).value).toBe(
      "Mon brouillon",
    );
    expect(root.querySelector("#hub-status")!.textContent).toBe("");
  });
  it("routes search and pagination with filters in the URL", async () => {
    fetcher.mockResolvedValue(
      json({ items: [], total: 45, page: 1, page_size: 20 }),
    );
    start("admin/users?access=unpaid", admin);
    await loaded("#filter-q");
    await field("filter-q", "Compte test");
    click("filter");
    expect(nav).toHaveBeenCalledWith("admin/users?q=Compte+test&access=unpaid");
    click("next");
    expect(nav).toHaveBeenCalledWith("admin/users?access=unpaid&page=2");
  });
  it("expires the session on 401 rather than retaining a private view", async () => {
    fetcher.mockResolvedValue(json({ error: "Session expirée" }, 401));
    start("tickets");
    await vi.waitFor(() => expect(expired).toHaveBeenCalledOnce());
  });
  it("does not infer access from a bare client admin flag or malformed server flags", async () => {
    expect(hasAccess({ is_paid: false, paid_at: null, is_admin: true })).toBe(
      false,
    );
    expect(
      hasAccess({
        is_paid: false,
        paid_at: null,
        is_admin: true,
        has_access: true,
      }),
    ).toBe(true);
    fetcher.mockResolvedValue(
      json({
        is_paid: false,
        paid_at: null,
        is_admin: "true",
        has_access: true,
      }),
    );
    await expect(checkPaymentStatus()).rejects.toThrow("État du paiement");
  });
  it("never presents admin access as a completed paid purchase", () => {
    root.innerHTML = pricingPage(user, {
      is_paid: false,
      paid_at: null,
      is_admin: true,
      has_access: true,
    });
    expect(root.textContent).toContain("Accès administrateur gratuit");
    expect(root.querySelector("#pricing-page")).toBeNull();
    expect(root.textContent).not.toContain("Paiement confirmé");
  });
  it("has bounded mobile layouts and reduced-motion rules, not browser validation", () => {
    const css = readFileSync("src/hub.css", "utf8");
    expect(css).toMatch(/@media\s*\(max-width:\s*700px\)/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain("calc(100% - 32px)");
  });
  it("uses a single Material confirmation dialog and cancels without closing a ticket", async () => {
    fetcher.mockResolvedValue(
      json({ ticket, messages: [], total: 0, page: 1, page_size: 50 }),
    );
    start("tickets/" + ticketId);
    await loaded("#reply-form");
    click("close-ticket");
    click("close-ticket");
    await loaded("md-dialog");
    expect(root.querySelectorAll("md-dialog")).toHaveLength(1);
    (root.querySelector('[data-confirm="no"]') as HTMLElement).click();
    await Promise.resolve();
    expect(root.querySelector("md-dialog")).toBeNull();
    expect(fetcher.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(
      false,
    );
  });
  it("confirms a state change and reloads the closed thread", async () => {
    let closed = false;
    fetcher.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        closed = true;
        return json({ ok: true });
      }
      return json({
        ticket: { ...ticket, status: closed ? "closed" : "open" },
        messages: [],
        total: 0,
        page: 1,
        page_size: 50,
      });
    });
    start("tickets/" + ticketId);
    await loaded("#reply-form");
    click("close-ticket");
    await loaded("md-dialog");
    (root.querySelector('[data-confirm="yes"]') as HTMLElement).click();
    await loaded('[data-hub="reopen"]');
    expect(root.querySelector("#reply-form")).toBeNull();
    click("reopen");
    await vi.waitFor(() =>
      expect(
        fetcher.mock.calls.filter((c) => c[1]?.method === "PATCH"),
      ).toHaveLength(2),
    );
  });
});
