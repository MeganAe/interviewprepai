import { vi } from "vitest";
// DOM-only tests. No browser, layout engine, or real AI call.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((q: string) => ({
    matches: q.includes("prefers-reduced-motion"),
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  })),
});
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.animate = vi.fn(() => ({
  finished: Promise.resolve(),
  cancel() {},
  finish() {},
  addEventListener() {},
  removeEventListener() {},
})) as any;
URL.createObjectURL = vi.fn(() => "blob:test-export");
URL.revokeObjectURL = vi.fn();
// happy-dom does not implement ElementInternals. This adapter forwards the
// validity flags calculated by Material Web; it does not bypass validation.
const internals = new WeakMap<HTMLElement, any>();
HTMLElement.prototype.attachInternals = function () {
  if (internals.has(this)) return internals.get(this);
  const host = this;
  const item = {
    get form() {
      return host.closest("form");
    },
    get labels() {
      return [];
    },
    states: new Set(),
    validity: { valid: true } as Record<string, boolean>,
    validationMessage: "",
    willValidate: true,
    setFormValue() {},
    setValidity(flags: Record<string, boolean> = {}, message = "") {
      this.validity = {
        ...flags,
        valid: !Object.entries(flags).some(([k, v]) => k !== "valid" && v),
      };
      this.validationMessage = message;
    },
    checkValidity() {
      return this.validity.valid;
    },
    reportValidity() {
      if (!this.validity.valid)
        host.dispatchEvent(new Event("invalid", { cancelable: true }));
      return this.validity.valid;
    },
  };
  internals.set(host, item);
  return item;
} as any;
