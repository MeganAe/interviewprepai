import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPaymentStatus,
  initiateCheckout,
  validateCustomer,
  validCheckoutUrl,
} from "../src/services/checkout";
import { pricingPage, mountPricing } from "../src/pages/pricing";
import { merciPage, mountMerci } from "../src/pages/merci";
const user = { name: "Compte Test", email: "compte@example.test" };
const customer = {
  firstName: "Compte",
  lastName: "Test",
  email: user.email,
  phone: "06 12 34 56 78",
  countryCode: "FR",
};
const offer = {
  product_id: "prd_test",
  name: "Accès test",
  price: { value: 29, formatted: "29 €", currency: "EUR" },
  billing: "one_time",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let dispose = () => {};
afterEach(() => {
  dispose();
  dispose = () => {};
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Checkout service and Material payment screens (DOM only)", () => {
  it("validates customer names, email, country and national phone", () => {
    expect(validateCustomer(customer)).toBeNull();
    for (const change of [
      { firstName: "" },
      { lastName: "a".repeat(51) },
      { email: "not-email" },
      { phone: "+33612345678" },
      { phone: "123" },
      { countryCode: "France" },
    ])
      expect(validateCustomer({ ...customer, ...change })).not.toBeNull();
  });
  it.each([
    "http://example.test",
    "javascript:alert(1)",
    "https://user:password@example.test",
    "//example.test",
    "garbage",
  ])("rejects unsafe checkout URL %s", (url) =>
    expect(validCheckoutUrl(url)).toBe(false),
  );
  it("calls authenticated endpoint with CSRF header and no client-owned metadata", async () => {
    const fetch = vi.fn(async () =>
      json({
        data: {
          step: "payment",
          payment: { checkout_url: "https://store.mychariow.com/pay/test" },
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await initiateCheckout(customer);
    expect(result.step).toBe("payment");
    expect(result.checkout_url).toBe("https://store.mychariow.com/pay/test");
    const [url, options] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/checkout");
    expect(options.credentials).toBe("same-origin");
    expect(options.headers).toMatchObject({
      "X-Requested-With": "InterviewPrep",
    });
    expect(JSON.parse(options.body as string)).not.toHaveProperty(
      "custom_metadata",
    );
  });
  it("retains status/code for authentication and provider reconciliation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(
          { code: "PAYMENT_LINK_MISSING", error: "Ne payez pas deux fois." },
          409,
        ),
      ),
    );
    await expect(initiateCheckout(customer)).rejects.toMatchObject({
      status: 409,
      code: "PAYMENT_LINK_MISSING",
    });
  });
  it("rejects malformed authoritative payment status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ is_paid: "true" })),
    );
    await expect(checkPaymentStatus()).rejects.toThrow(
      "État du paiement indisponible",
    );
  });
  it("shows no invented amount when the live offer is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "Tarif indisponible." }, 503)),
    );
    document.body.innerHTML = pricingPage(user, {
      is_paid: false,
      paid_at: null,
    });
    const root = document.querySelector<HTMLElement>("#pricing-page")!;
    dispose = mountPricing(root, {
      user,
      onAuth: vi.fn(),
      onCompleted: vi.fn(),
      redirect: vi.fn(),
      onError: vi.fn(),
    });
    await vi.waitFor(() =>
      expect(root.querySelector("#offer-price")!.textContent).toBe(
        "Tarif indisponible",
      ),
    );
    expect(
      root.querySelector('[data-payment="submit"]')!.hasAttribute("disabled"),
    ).toBe(true);
    expect(root.querySelectorAll("md-filled-text-field")).toHaveLength(5);
    expect(
      root.querySelector("#checkout-email")!.hasAttribute("readonly"),
    ).toBe(true);
  });
  it("renders the real price and redirects using the returned payment URL", async () => {
    const redirect = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        path.endsWith("/offer")
          ? json(offer)
          : json({
              data: {
                step: "payment",
                payment: {
                  checkout_url: "https://store.mychariow.com/pay/test",
                },
              },
            }),
      ),
    );
    document.body.innerHTML = pricingPage(user, {
      is_paid: false,
      paid_at: null,
    });
    const root = document.querySelector<HTMLElement>("#pricing-page")!;
    dispose = mountPricing(root, {
      user,
      onAuth: vi.fn(),
      onCompleted: vi.fn(),
      redirect,
      onError: vi.fn(),
    });
    await vi.waitFor(() =>
      expect(root.querySelector("#offer-price")!.textContent).toBe("29 €"),
    );
    for (const [id, value] of Object.entries({
      "checkout-first": "Compte",
      "checkout-last": "Test",
      "checkout-email": user.email,
      "checkout-country": "FR",
      "checkout-phone": "0612345678",
    })) {
      const field = root.querySelector("#" + id) as any;
      await field.updateComplete;
      field.value = value;
    }
    (root.querySelector('[data-payment="submit"]') as HTMLElement).click();
    await vi.waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(
        "https://store.mychariow.com/pay/test",
      ),
    );
  });
  it.each(["already_paid", "completed"])(
    "handles %s without pretending a signed confirmation arrived",
    async (step) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => json({ data: { step, payment: null } })),
      );
      const response = await initiateCheckout(customer);
      expect(response.step).toBe(step);
      expect(response).not.toHaveProperty("is_paid");
    },
  );
  it("never confirms payment from the merci URL alone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ is_paid: false, paid_at: null })),
    );
    document.body.innerHTML = merciPage(null);
    const root = document.querySelector<HTMLElement>("#merci-page")!,
      onConfirmed = vi.fn();
    dispose = mountMerci(root, null, { onConfirmed, onAuth: vi.fn() });
    await Promise.resolve();
    expect(root.querySelector("#merci-title")!.textContent).toContain(
      "attendons",
    );
    expect(root.querySelector("#merci-home")!.hasAttribute("disabled")).toBe(
      true,
    );
    expect(onConfirmed).not.toHaveBeenCalled();
  });
  it("confirms only after a server-paid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ is_paid: true, paid_at: "2026-09-08T12:00:00Z" }),
      ),
    );
    document.body.innerHTML = merciPage(null);
    const root = document.querySelector<HTMLElement>("#merci-page")!,
      onConfirmed = vi.fn();
    dispose = mountMerci(root, null, { onConfirmed, onAuth: vi.fn() });
    await vi.waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce());
    expect(root.querySelector("#merci-title")!.textContent).toContain(
      "accès est actif",
    );
    expect(root.querySelector("#merci-home")!.hasAttribute("disabled")).toBe(
      false,
    );
  });
});
