import { beforeAll, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { set as storeSet, del as storeDel } from "idb-keyval";
const storage = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (k: string) => structuredClone(storage.get(k))),
  set: vi.fn(async (k: string, v: unknown) => {
    storage.set(k, structuredClone(v));
  }),
  del: vi.fn(async (k: string) => {
    storage.delete(k);
  }),
}));
const profile = {
  id: "test-account",
  name: "Compte de test",
  email: "test@example.test",
};
let signedIn = false;
let data: { cvs: any[]; sessions: any[] } = { cvs: [], sessions: [] };
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const apiMock = vi.fn(
  async (input: string | URL | Request, init: RequestInit = {}) => {
    const path = String(input),
      body = typeof init.body === "string" ? JSON.parse(init.body) : {};
    if (path === "/api/me" && (!init.method || init.method === "GET"))
      return signedIn ? json(profile) : json({}, 401);
    if (path === "/api/auth/register") {
      signedIn = true;
      profile.name = body.name;
      return json(profile);
    }
    if (path === "/api/auth/login") {
      if (body.password === "wrong-password")
        return json({ error: "E-mail ou mot de passe incorrect." }, 401);
      signedIn = true;
      return json(profile);
    }
    if (path === "/api/auth/logout") {
      signedIn = false;
      return json({ ok: true });
    }
    if (path === "/api/me" && init.method === "DELETE") {
      signedIn = false;
      return json({ ok: true });
    }
    if (path === "/api/me" && init.method === "PUT") {
      profile.name = body.name;
      return json({ ok: true });
    }
    if (path === "/api/checkout/status")
      return signedIn
        ? json({ is_paid: true, paid_at: "2026-09-08T12:00:00Z" })
        : json({}, 401);
    if (path === "/api/data" || path === "/api/account/export")
      return json(data);
    if (path === "/api/cvs")
      return json({ error: "Le service d’analyse est indisponible." }, 503);
    if (path === "/api/sessions") {
      const s = {
        id: "test-session",
        role: body.role,
        level: body.level,
        cvName: "cv-test.pdf",
        createdAt: "2026-09-08T12:00:00Z",
        questions: Array.from({ length: body.count }, (_, i) => ({
          category: "Test",
          text: `Question de test ${i + 1}`,
          hint: "Indication de test",
        })),
        answers: Array(body.count).fill(""),
        result: null,
      };
      data.sessions.push(s);
      return json(s);
    }
    if (path.endsWith("/answers")) {
      data.sessions[0].answers = body.values;
      return json(data.sessions[0]);
    }
    if (path.endsWith("/evaluate")) {
      data.sessions[0].result = {
        score: 75,
        summary: "Bilan de test uniquement",
        criteria: [
          { name: "Pertinence", score: 75, comment: "Test" },
          { name: "Structure", score: 75, comment: "Test" },
          { name: "Précision", score: 75, comment: "Test" },
        ],
        strengths: ["Point fort test"],
        improvements: ["Amélioration test"],
        feedback: Array.from({ length: 5 }, () => ({
          comment: "Retour test",
          example: "Exemple test",
        })),
      };
      return json(data.sessions[0]);
    }
    if (path.startsWith("/api/records/") && init.method === "DELETE") {
      const id = path.split("/").pop();
      data.sessions = data.sessions.filter((s) => s.id !== id);
      data.cvs = data.cvs.filter((c) => c.id !== id);
      return json({ ok: true });
    }
    throw new Error("Unexpected test API: " + path + " " + init.method);
  },
);
const pause = async () => {
  await new Promise((r) => setTimeout(r, 25));
};
const el = (selector: string) => {
  const e = document.querySelector<HTMLElement>(selector);
  expect(e, selector).not.toBeNull();
  return e!;
};
async function click(selector: string) {
  el(selector).click();
  await pause();
}
async function field(id: string, text: string) {
  const f = el("#" + id) as any;
  await f.updateComplete;
  f.value = text;
  f.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  await pause();
}
async function hash(route: string) {
  history.pushState({}, "", `#${route}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await pause();
}
async function login() {
  await hash("login");
  await field("auth-email", profile.email);
  await field("auth-password", "valid-test-password");
  await click('[data-act="submit-login"]');
}
beforeAll(async () => {
  vi.stubGlobal("fetch", apiMock);
  history.replaceState({}, "", "#home");
  document.body.innerHTML =
    '<div id="app"></div><div id="modal-root"></div><div id="toast" role="status"></div>';
  await import("../src/main");
  await pause();
});
describe.sequential(
  "Public website and account navigation (DOM, not browser)",
  () => {
    it("shows a real public landing instead of an anonymous dashboard", () => {
      expect(location.hash).toBe("#welcome");
      expect(document.querySelector(".landing-hero")).not.toBeNull();
      expect(document.querySelector(".sidebar")).toBeNull();
      expect(el("h1").textContent).toContain("Trouvez les mots");
    });
    it("uses the interview conversation logo and correct semantic illustration containers", () => {
      expect(
        document.querySelector(".wordmark .brand-symbol path"),
      ).not.toBeNull();
      expect(el(".landing-illustration").querySelector("svg")).not.toBeNull();
      const css = readFileSync("./src/refinements.css", "utf8");
      expect(css).toMatch(/\.practice-visual\s*\{[^}]*overflow:\s*hidden/s);
      expect(css).toMatch(
        /\.practice-visual\s*>\s*svg\s*\{[^}]*width:\s*174px/s,
      );
    });
    it("navigates the public menu, opens the FAQ and updates the mobile menu state", async () => {
      await click('[data-act="public-menu"]');
      expect(el(".public-menu-button").getAttribute("aria-expanded")).toBe(
        "true",
      );
      await click('.marketing-nav a[href="#welcome/methode"]');
      expect(location.hash).toBe("#welcome/methode");
      expect(document.querySelector(".marketing-nav.open")).toBeNull();
      await click('a[href="#welcome/faq"]');
      expect(location.hash).toBe("#welcome/faq");
      await click(".faq-list summary");
      expect(el(".faq-list details").hasAttribute("open")).toBe(true);
    });
    it("opens registration as its own page, not a dialog", async () => {
      await click('.public-header [data-act="register"]');
      expect(location.hash).toBe("#register");
      expect(el("#auth-title").textContent).toContain("Créer votre compte");
      expect(document.querySelector("md-dialog")).toBeNull();
    });
    it("preserves registration fields while viewing and closing confidentiality", async () => {
      await field("auth-name", "Nom de test");
      await click('.auth-privacy [data-act="privacy"]');
      expect(el("md-dialog").textContent).toContain("Google Gemini");
      await click('md-dialog [data-act="close"]');
      expect(document.querySelector("md-dialog")).toBeNull();
      expect((el("#auth-name") as any).value).toBe("Nom de test");
    });
    it("validates required fields before requesting registration", async () => {
      const before = apiMock.mock.calls.length;
      await click('[data-act="submit-register"]');
      expect(apiMock.mock.calls.length).toBe(before);
      expect(location.hash).toBe("#register");
    });
    it("creates an account, redirects to the dashboard and clears modal overlays", async () => {
      await field("auth-name", "Utilisateur test");
      await field("auth-email", "test@example.test");
      await field("auth-password", "valid-test-password");
      await click('[data-act="submit-register"]');
      await vi.waitFor(() => expect(location.hash).toBe("#home"));
      expect(el(".welcome h1").textContent).toContain("Utilisateur");
      expect(document.querySelector("md-dialog")).toBeNull();
    });
    it("navigates every desktop destination explicitly", async () => {
      for (const route of [
        "cv",
        "practice",
        "history",
        "saved",
        "settings",
        "home",
      ]) {
        await click(`.sidebar a[href="#${route}"]`);
        expect(location.hash).toBe("#" + route);
        expect(
          el(`.sidebar .nav-link[href="#${route}"]`).getAttribute(
            "aria-current",
          ),
        ).toBe("page");
        expect(el("main").textContent?.trim().length).toBeGreaterThan(50);
      }
    });
    it("navigates every mobile destination and closes the drawer", async () => {
      for (const route of ["home", "search", "saved", "settings"]) {
        await click(`.bottom-nav a[href="#${route}"]`);
        expect(location.hash).toBe("#" + route);
      }
      await click('[data-act="menu"]');
      expect(el(".sidebar").classList.contains("open")).toBe(true);
      await click('.sidebar a[href="#cv"]');
      expect(el(".sidebar").classList.contains("open")).toBe(false);
    });
    it("goes from the more-options dialog to settings without leaving a blocking dialog", async () => {
      await click('[data-act="more"]');
      expect(document.querySelector("md-dialog")).not.toBeNull();
      await click('md-dialog [data-act="settings"]');
      expect(location.hash).toBe("#settings");
      expect(document.querySelector("md-dialog")).toBeNull();
      await click('.sidebar a[href="#practice"]');
      expect(location.hash).toBe("#practice");
    });
    it("keeps the practice artwork in a separate constrained container and chips inline", () => {
      expect(el(".practice-visual").querySelector("svg")).not.toBeNull();
      expect(el(".practice-card-copy").parentElement).toBe(
        el(".practice-card"),
      );
      expect(el(".practice-card-copy h2").textContent).toContain(
        "à partir de votre CV",
      );
      expect(document.querySelector(".practice-card-copy svg")).toBeNull();
    });
    it("keeps provider and theme jargon out of everyday screens", async () => {
      for (const route of [
        "home",
        "cv",
        "practice",
        "history",
        "saved",
        "settings",
        "search",
      ]) {
        await hash(route);
        expect(el("#app").textContent).not.toMatch(
          /Gemini|Material 3|thème ambre|La confiance se construit|vous êtes au bon endroit/i,
        );
      }
    });
    it("requires an imported CV and allows switching from configuration to upload", async () => {
      await hash("practice");
      await click('[data-act="upload"]');
      await click('[data-act="close"]');
      await hash("history");
      await click('.page-title [data-act="start"]');
      expect(el("md-dialog").textContent).toContain("Un CV est nécessaire");
      await click('md-dialog [data-act="upload"]');
      expect(el("md-dialog").textContent).toContain("Importer un CV");
      await click('md-dialog [data-act="analyze"]');
      expect(el("#modal-error").textContent).toContain("Choisissez");
      await click('md-dialog [data-act="close"]');
    });
    it("creates, persists, edits, searches and deletes a personal note", async () => {
      await hash("saved");
      await click('.page-title [data-act="new-note"]');
      await field("note-title", "Projet migration");
      await field("note-body", "Expliquer mon rôle et le résultat du projet.");
      await click('[data-act="save-note"]');
      expect(location.hash).toBe("#saved");
      expect(el(".note-card").textContent).toContain("Projet migration");
      expect(storage.get("prep:test-account")).toBeTruthy();
      await click('.note-card [data-act="edit-note"]');
      await field("note-title", "Projet migration réussi");
      await click('[data-act="save-note"]');
      await hash("search");
      await field("global-search", "migration");
      expect(el("#search-results").textContent).toContain(
        "Projet migration réussi",
      );
      await click('[data-act="delete-note"]');
      await click('md-dialog [data-act="close"]');
      expect(el("#search-results").textContent).toContain("Projet migration");
      await click('[data-act="delete-note"]');
      await click('[data-act="confirm"]');
      expect(el("#search-results").textContent).not.toContain(
        "Projet migration",
      );
    });
    it("edits the profile and toggles a persistent preference", async () => {
      await hash("settings");
      await click('[data-act="edit-profile"]');
      await field("profile-name", "Nouveau test");
      await click('[data-act="save-profile"]');
      expect(el("main").textContent).toContain("Nouveau test");
      const sw = el("#notifications") as any;
      sw.selected = false;
      sw.dispatchEvent(new Event("change", { bubbles: true }));
      await pause();
      expect((storage.get("prep:test-account") as any).notifications).toBe(
        false,
      );
    });
    it("exports account data", async () => {
      await click('[data-act="export-all"]');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    it("logs out to the landing and protects deep links", async () => {
      await hash("settings");
      await click('[data-act="logout"]');
      expect(location.hash).toBe("#welcome");
      expect(document.querySelector(".sidebar")).toBeNull();
      await hash("history");
      expect(location.hash).toBe("#login");
    });
    it("completes login to the requested page with the Enter key", async () => {
      await field("auth-email", "test@example.test");
      await field("auth-password", "valid-test-password");
      el("#auth-password").dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          composed: true,
        }),
      );
      await pause();
      await vi.waitFor(() => expect(location.hash).toBe("#history"));
    });
    it("replays browser route changes and clears dialogs on history navigation", async () => {
      await hash("settings");
      await click('[data-act="more"]');
      history.replaceState({}, "", "#cv");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await pause();
      expect(location.hash).toBe("#cv");
      expect(document.querySelector("md-dialog")).toBeNull();
      expect(el(".page-title h1").textContent).toBe("Mes CV");
    });
    it("runs a complete interview UI flow and favorite removal", async () => {
      data.cvs = [
        {
          id: "test-cv",
          name: "cv-test.pdf",
          size: 100,
          createdAt: "2026-09-08T12:00:00Z",
          analysis: {
            role: "Poste de test",
            summary: "Résumé de test",
            skills: ["Test"],
            tips: ["Test"],
          },
        },
      ];
      await hash("settings");
      await click('[data-act="logout"]');
      await login();
      await hash("practice");
      await click('.practice-card [data-act="start"]');
      await pause();
      await field("start-cv", "test-cv");
      await field("start-role", "Poste de test");
      await field("start-level", "Débutant");
      await field("start-count", "5");
      await click('[data-act="create-session"]');
      await vi.waitFor(() =>
        expect(location.hash).toBe("#session/test-session"),
      );
      await click('[data-act="next-question"]');
      expect(el("#page-error").textContent).toContain("20 caractères");
      for (let i = 0; i < 5; i++) {
        await field(
          "answer",
          "Une réponse de test détaillée sur mon expérience professionnelle.",
        );
        await click(`[data-act="${i === 4 ? "evaluate" : "next-question"}"]`);
      }
      await vi.waitFor(() =>
        expect(location.hash).toBe("#results/test-session"),
      );
      expect(el(".score-ring").textContent).toContain("75");
      await click(".feedback summary");
      await click('.feedback [data-act="favorite"]');
      await hash("saved");
      await click('[data-act="saved-tab"][data-value="questions"]');
      expect(el("main").textContent).toContain("Question de test 1");
      await click('[data-act="favorite"]');
      expect(el("main").textContent).toContain("Aucune question favorite");
      await hash("history");
      await click('[data-act="open-session"]');
      await click('[data-act="delete-session"]');
      await click('[data-act="confirm"]');
      expect(location.hash).toBe("#history");
      expect(el("main").textContent).toContain("Aucun entretien enregistré");
    });
    it("reports a failed login without losing entered fields, then permits retry", async () => {
      await hash("settings");
      await click('[data-act="logout"]');
      await hash("login");
      await field("auth-email", "test@example.test");
      await field("auth-password", "wrong-password");
      await click('[data-act="toggle-password"]');
      expect((el("#auth-password") as any).type).toBe("text");
      await click('[data-act="submit-login"]');
      expect(location.hash).toBe("#login");
      expect(el("#auth-error").textContent).toContain("incorrect");
      expect((el("#auth-email") as any).value).toBe("test@example.test");
      expect(el('[data-act="submit-login"]').hasAttribute("disabled")).toBe(
        false,
      );
      await field("auth-password", "valid-test-password");
      await click('[data-act="submit-login"]');
      expect(location.hash).toBe("#home");
    });
    it("rejects non-PDF files and missing consent, and keeps an upload retryable after an API failure", async () => {
      await click('.hero [data-act="start"]');
      await click('md-dialog [data-act="close"]');
      await hash("cv");
      await click('.page-title [data-act="upload"]');
      const drop = (file: File) => {
        const event = new Event("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: { files: [file] },
        });
        el(".drop-zone").dispatchEvent(event);
      };
      drop(new File(["not pdf"], "test.txt", { type: "text/plain" }));
      expect(el("#modal-error").textContent).toContain("PDF");
      drop(new File(["%PDF-test"], "test.pdf", { type: "application/pdf" }));
      expect(el("#file-preview").textContent).toContain("test.pdf");
      const count = apiMock.mock.calls.length;
      await click('[data-act="analyze"]');
      expect(apiMock.mock.calls.length).toBe(count);
      expect(el("#modal-error").textContent).toContain("accord");
      (el("#pdf-consent") as any).checked = true;
      await click('[data-act="analyze"]');
      expect(el("#modal-error").textContent).toContain("indisponible");
      expect(el('[data-act="analyze"]').hasAttribute("disabled")).toBe(false);
      expect(el("#file-preview").textContent).toContain("test.pdf");
      await click('md-dialog [data-act="close"]');
      await click('.sidebar a[href="#history"]');
      expect(location.hash).toBe("#history");
    });
    it("reports a storage failure without claiming the note is saved and permits retry", async () => {
      await hash("saved");
      await click('.page-title [data-act="new-note"]');
      await field("note-title", "Note à conserver");
      await field("note-body", "Contenu utile pour mon entretien.");
      vi.mocked(storeSet).mockRejectedValueOnce(new Error("quota"));
      await click('[data-act="save-note"]');
      expect(el("#modal-error").textContent).toContain(
        "Enregistrement local impossible",
      );
      expect(document.querySelector("md-dialog")).not.toBeNull();
      await click('[data-act="save-note"]');
      expect(el(".note-card").textContent).toContain("Note à conserver");
    });
    it("confirms before clearing local data and preserves server CVs", async () => {
      await hash("settings");
      await click('[data-act="clear-local"]');
      await click('md-dialog [data-act="close"]');
      await hash("saved");
      expect(el(".note-card").textContent).toContain("Note à conserver");
      await hash("settings");
      await click('[data-act="clear-local"]');
      await click('[data-act="confirm"]');
      await hash("saved");
      await click('[data-act="saved-tab"][data-value="notes"]');
      expect(el("main").textContent).toContain("Aucune note enregistrée");
      await hash("cv");
      expect(el("main").textContent).toContain("cv-test.pdf");
    });
    it("reports successful server account deletion even when local cleanup fails", async () => {
      await hash("settings");
      vi.mocked(storeDel).mockRejectedValueOnce(
        new Error("Test storage failure"),
      );
      await click('[data-act="delete-account"]');
      expect(document.querySelector("md-dialog")).not.toBeNull();
      await click('[data-act="confirm"]');
      await vi.waitFor(() => expect(location.hash).toBe("#welcome"));
      expect(el("#toast").textContent).toContain("supprimé du serveur");
      expect(el("#toast").textContent).toContain("effacement local a échoué");
    });
  },
);
