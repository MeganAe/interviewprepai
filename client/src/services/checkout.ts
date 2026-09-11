export type PaymentStatus = { is_paid: boolean; paid_at: string | null };
export type CheckoutCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
};
export type CheckoutStep = {
  step: "payment" | "completed" | "already_paid";
  checkout_url: string | null;
};
export type Offer = {
  product_id: string;
  name: string;
  price: { value: number; formatted: string; currency: string };
  billing: "one_time";
};
export class CheckoutError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
async function request(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<any> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = window.setTimeout(abort, 40000);
  try {
    const response = await fetch("/api/checkout" + path, {
      ...options,
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "X-Requested-With": "InterviewPrep",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new CheckoutError(
        json.error ??
          (response.status === 401
            ? "Connectez-vous pour continuer."
            : "Le service de paiement est indisponible."),
        response.status,
        json.code ??
          (response.status === 401 ? "AUTH_REQUIRED" : "PAYMENT_ERROR"),
      );
    return json;
  } catch (e) {
    if (e instanceof CheckoutError) throw e;
    if (signal?.aborted) throw e;
    throw new CheckoutError(
      controller.signal.aborted
        ? "Le délai de réponse est dépassé. Réessayez."
        : "Connexion au service de paiement impossible.",
      0,
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export async function initiateCheckout(
  customer: CheckoutCustomer,
  signal?: AbortSignal,
): Promise<CheckoutStep> {
  const response = await request(
    "",
    { method: "POST", body: JSON.stringify(customer) },
    signal,
  );
  const data = response.data;
  if (!data || !["payment", "completed", "already_paid"].includes(data.step))
    throw new CheckoutError(
      "Réponse de paiement invalide.",
      502,
      "INVALID_RESPONSE",
    );
  const url = data.payment?.checkout_url ?? null;
  if (data.step === "payment" && !validCheckoutUrl(url))
    throw new CheckoutError(
      "Le lien de paiement est invalide.",
      502,
      "INVALID_URL",
    );
  return { step: data.step, checkout_url: url };
}
export function validCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}
export async function checkPaymentStatus(
  signal?: AbortSignal,
): Promise<PaymentStatus> {
  const result = await request("/status", {}, signal);
  if (
    typeof result.is_paid !== "boolean" ||
    (result.paid_at !== null && typeof result.paid_at !== "string")
  )
    throw new CheckoutError(
      "État du paiement indisponible.",
      502,
      "INVALID_STATUS",
    );
  return result;
}
export async function getOffer(signal?: AbortSignal): Promise<Offer> {
  const offer = await request("/offer", {}, signal);
  if (
    !offer.price ||
    typeof offer.price.formatted !== "string" ||
    !Number.isFinite(offer.price.value)
  )
    throw new CheckoutError("Tarif indisponible.", 502, "INVALID_OFFER");
  return offer;
}
export function validateCustomer(c: CheckoutCustomer): string | null {
  if (
    !c.firstName.trim() ||
    c.firstName.trim().length > 50 ||
    !c.lastName.trim() ||
    c.lastName.trim().length > 50
  )
    return "Saisissez votre prénom et votre nom (50 caractères maximum chacun).";
  if (c.email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
    return "Saisissez une adresse e-mail valide.";
  if (!/^[0-9]{6,15}$/.test(c.phone.replace(/[\s().-]/g, "")))
    return "Saisissez votre numéro national, sans indicatif international (6 à 15 chiffres).";
  if (!/^[A-Z]{2}$/.test(c.countryCode.trim().toUpperCase()))
    return "Saisissez le code pays à deux lettres : FR, CI, SN, CM…";
  return null;
}
