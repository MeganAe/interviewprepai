import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
const mock = vi.hoisted(() => ({ animate: vi.fn() }));
vi.mock("motion/mini", () => ({ animate: mock.animate }));
import { initSiteMotion } from "../src/services/motion";
import { brandMark, wordmark } from "../src/brand";
import { interviewArt } from "../src/interview-art";
let root: HTMLElement,
  dispose = () => {};
let reduce: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
let controls: {
  cancel: ReturnType<typeof vi.fn>;
  finished: Promise<void>;
  resolve: () => void;
}[] = [];
let observations: {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => {
  controls = [];
  observations = [];
  mock.animate.mockReset();
  mock.animate.mockImplementation(() => {
    let resolve!: () => void;
    const c = {
      cancel: vi.fn(),
      finished: new Promise<void>((r) => (resolve = r)),
      resolve: () => resolve(),
    };
    controls.push(c);
    return c;
  });
  reduce = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) =>
      query.includes("prefers-reduced-motion")
        ? reduce
        : {
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          },
    ),
  );
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      constructor(public callback: IntersectionObserverCallback) {
        observations.push(this);
      }
    },
  );
  history.replaceState({}, "", "#welcome");
  document.body.innerHTML =
    '<div id="motion-root"><header class="public-header"><a class="wordmark" href="#home">Accueil</a></header><main id="main-content"><div class="landing-copy"><h1>Un entretien</h1><p>Votre préparation</p></div><div class="method-card">Une méthode</div><form><input name="example" value="Texte conservé"></form></main></div>';
  root = document.querySelector("#motion-root")!;
});
afterEach(() => {
  dispose();
  dispose = () => {};
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
describe("Expressive enhancement without changing application behaviour", () => {
  it("adds staggered entry motion and keeps forms intact", () => {
    dispose = initSiteMotion(root);
    expect(mock.animate).toHaveBeenCalledTimes(3);
    expect(mock.animate.mock.calls[2][2].delay).toBeGreaterThan(
      mock.animate.mock.calls[1][2].delay,
    );
    expect((root.querySelector("input") as HTMLInputElement).value).toBe(
      "Texte conservé",
    );
    expect(root.querySelectorAll("form")).toHaveLength(1);
  });
  it("does not animate or hide content when reduced motion is requested", () => {
    reduce.matches = true;
    dispose = initSiteMotion(root);
    expect(mock.animate).not.toHaveBeenCalled();
    expect(observations).toHaveLength(0);
    expect(root.querySelector("h1")!.getAttribute("style")).toBeNull();
    expect(document.documentElement.dataset.siteMotion).toBe("reduced");
  });
  it("uses the reverse direction for a back navigation", () => {
    root.dataset.direction = "back";
    dispose = initSiteMotion(root);
    expect(mock.animate.mock.calls[1][1].transform[0]).toBe(
      "translate3d(-18px,0,0)",
    );
  });
  it("reveals cards on intersection once, not while they are offscreen", () => {
    dispose = initSiteMotion(root);
    const card = root.querySelector(".method-card")!;
    expect(observations[0].observe).toHaveBeenCalledWith(card);
    const count = mock.animate.mock.calls.length;
    observations[0].callback(
      [{ target: card, isIntersecting: false }] as any,
      {} as any,
    );
    expect(mock.animate).toHaveBeenCalledTimes(count);
    observations[0].callback(
      [{ target: card, isIntersecting: true }] as any,
      {} as any,
    );
    expect(mock.animate).toHaveBeenCalledTimes(count + 1);
    expect(observations[0].unobserve).toHaveBeenCalledWith(card);
  });
  it("cancels old animations and disconnects observers when the page is replaced", async () => {
    dispose = initSiteMotion(root);
    const previous = [...controls],
      observation = observations[0];
    root.innerHTML = '<main id="main-content">Autre page</main>';
    await flush();
    previous.forEach((c) => expect(c.cancel).toHaveBeenCalled());
    expect(observation.disconnect).toHaveBeenCalled();
  });
  it("restores inline styles on completion so hover and focus styles still work", async () => {
    const h = root.querySelector("h1") as HTMLElement;
    h.style.transform = "scale(1)";
    dispose = initSiteMotion(root);
    h.style.transform = "translateY(10px)";
    controls[1].resolve();
    await flush();
    expect(h.style.transform).toBe("scale(1)");
    expect(h.style.opacity).toBe("");
  });
  it("handles missing animation support without breaking the page", () => {
    mock.animate.mockImplementation(() => {
      throw new Error("WAAPI unavailable");
    });
    expect(() => {
      dispose = initSiteMotion(root);
    }).not.toThrow();
    expect(root.textContent).toContain("Votre préparation");
    expect(root.querySelector("input")).not.toBeNull();
  });
  it("stops active motion immediately when the system preference changes", () => {
    dispose = initSiteMotion(root);
    reduce.matches = true;
    reduce.addEventListener.mock.calls[0][1]();
    controls.forEach((c) => expect(c.cancel).toHaveBeenCalled());
    expect(document.documentElement.dataset.siteMotion).toBe("reduced");
  });
  it("adds one standard Material ripple to plain navigation links", async () => {
    dispose = initSiteMotion(root);
    const link = root.querySelector(".wordmark")!;
    expect(link.querySelectorAll("md-ripple")).toHaveLength(1);
    root.append(document.createElement("div"));
    await flush();
    expect(link.querySelectorAll("md-ripple")).toHaveLength(1);
  });
  it("unregisters global listeners when disposed", () => {
    dispose = initSiteMotion(root);
    dispose();
    expect(reduce.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    expect(document.documentElement.dataset.siteMotion).toBeUndefined();
    dispose = () => {};
  });
  it("uses a bespoke interview mark, bounded illustration, and accessible home link", () => {
    document.body.innerHTML = wordmark() + interviewArt();
    expect(document.querySelectorAll(".brand-person")).toHaveLength(2);
    expect(document.querySelector(".brand-conversation")).not.toBeNull();
    expect(
      document.querySelector(".wordmark")!.getAttribute("aria-label"),
    ).toContain("accueil");
    expect(
      document.querySelector(".interview-scene")!.getAttribute("viewBox"),
    ).toBe("0 0 420 370");
    expect(brandMark()).not.toContain("M26 42V17H34");
  });
  it("keeps headers sticky, defines mobile margins and disables decorative motion for accessibility", () => {
    const css = readFileSync("src/expressive.css", "utf8");
    expect(css).toMatch(
      /\.public-header,\s*\.appbar\s*\{[^}]*position:\s*sticky/s,
    );
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toContain("calc(100% - 32px)");
    expect(css).not.toContain("infinite");
    expect(css).not.toMatch(/#[a-fA-F0-9]{6}\b/); // UI colour values must use scheme roles.
  });
});
