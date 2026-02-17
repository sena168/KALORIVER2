import * as crypto from "node:crypto";
import { PaymentProvider, PaymentStatus } from "@prisma/client";

const safeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const nowSeconds = () => Math.floor(Date.now() / 1000);

const getAppBaseUrl = () => {
  const explicit = safeString(process.env.APP_BASE_URL);
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = safeString(process.env.VERCEL_URL);
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;
  return "http://localhost:5173";
};

const parseJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
};

const toBasicAuth = (key: string) =>
  `Basic ${Buffer.from(`${key}:`).toString("base64")}`;

const toMd5 = (value: string) => crypto.createHash("md5").update(value).digest("hex");
const toSha512 = (value: string) => crypto.createHash("sha512").update(value).digest("hex");

export const createOrderId = (provider: PaymentProvider) => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${provider}-${nowSeconds()}-${suffix}`;
};

export const getPremiumAmount = () => {
  const fallback = 49000;
  const parsed = Number(process.env.PREMIUM_PRICE_IDR ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
};

export const getPremiumProductName = () =>
  safeString(process.env.PREMIUM_PRODUCT_NAME) || "Kalori Premium";

type CheckoutInput = {
  orderId: string;
  amount: number;
  email?: string | null;
  uid: string;
  displayName?: string | null;
};

type CheckoutResult = {
  checkoutUrl: string;
  externalReference?: string | null;
  rawResponse?: unknown;
  expiresAt?: Date | null;
};

const createMidtransCheckout = async (input: CheckoutInput): Promise<CheckoutResult> => {
  const serverKey = safeString(process.env.MIDTRANS_SERVER_KEY);
  if (!serverKey) throw new Error("Missing MIDTRANS_SERVER_KEY");

  const snapBaseUrl =
    safeString(process.env.MIDTRANS_SNAP_BASE_URL) ||
    "https://app.sandbox.midtrans.com";

  const payload = {
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.amount,
    },
    item_details: [
      {
        id: "premium-account",
        price: input.amount,
        quantity: 1,
        name: getPremiumProductName(),
      },
    ],
    customer_details: {
      first_name: input.displayName || input.uid,
      email: input.email || undefined,
    },
    callbacks: {
      finish: `${getAppBaseUrl()}/payment`,
    },
  };

  const res = await fetch(`${snapBaseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: toBasicAuth(serverKey),
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(res);
  if (!res.ok) {
    const message = safeString((data as { error_messages?: string[] }).error_messages?.[0]);
    throw new Error(message || "Midtrans checkout creation failed");
  }

  const redirectUrl = safeString((data as { redirect_url?: string }).redirect_url);
  if (!redirectUrl) throw new Error("Midtrans redirect_url missing");

  return {
    checkoutUrl: redirectUrl,
    externalReference: safeString((data as { token?: string }).token) || null,
    rawResponse: data,
  };
};

const createDuitkuCheckout = async (input: CheckoutInput): Promise<CheckoutResult> => {
  const merchantCode = safeString(process.env.DUITKU_MERCHANT_CODE);
  const apiKey = safeString(process.env.DUITKU_API_KEY);
  if (!merchantCode || !apiKey) {
    throw new Error("Missing DUITKU_MERCHANT_CODE or DUITKU_API_KEY");
  }

  const endpoint =
    safeString(process.env.DUITKU_INQUIRY_URL) ||
    "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry";
  const callbackUrl =
    safeString(process.env.DUITKU_CALLBACK_URL) ||
    `${getAppBaseUrl()}/api/payments/webhook?provider=duitku`;
  const returnUrl =
    safeString(process.env.DUITKU_RETURN_URL) || `${getAppBaseUrl()}/payment`;
  const expiryMinutes = Math.max(10, Number(process.env.DUITKU_EXPIRY_MINUTES || 60));

  const signature = toMd5(`${merchantCode}${input.orderId}${input.amount}${apiKey}`);
  const body = {
    merchantCode,
    paymentAmount: input.amount,
    merchantOrderId: input.orderId,
    productDetails: getPremiumProductName(),
    customerVaName: input.displayName || input.uid,
    email: input.email || undefined,
    callbackUrl,
    returnUrl,
    expiryPeriod: expiryMinutes,
    signature,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await parseJson(res);
  if (!res.ok) {
    const message = safeString((data as { Message?: string }).Message);
    throw new Error(message || "Duitku checkout creation failed");
  }

  const paymentUrl = safeString((data as { paymentUrl?: string }).paymentUrl);
  if (!paymentUrl) throw new Error("Duitku paymentUrl missing");

  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  return {
    checkoutUrl: paymentUrl,
    externalReference: safeString((data as { reference?: string }).reference) || null,
    rawResponse: data,
    expiresAt,
  };
};

const createPakkasirCheckout = async (input: CheckoutInput): Promise<CheckoutResult> => {
  const baseUrl = safeString(process.env.PAKKASIR_CHECKOUT_URL);
  if (!baseUrl) throw new Error("Missing PAKKASIR_CHECKOUT_URL");

  const url = new URL(baseUrl);
  url.searchParams.set("orderId", input.orderId);
  url.searchParams.set("amount", String(input.amount));
  url.searchParams.set("uid", input.uid);
  if (input.email) url.searchParams.set("email", input.email);
  return { checkoutUrl: url.toString(), rawResponse: { paymentUrl: url.toString() } };
};

export const createCheckout = async (
  provider: PaymentProvider,
  input: CheckoutInput,
): Promise<CheckoutResult> => {
  if (provider === PaymentProvider.MIDTRANS) return createMidtransCheckout(input);
  if (provider === PaymentProvider.DUITKU) return createDuitkuCheckout(input);
  return createPakkasirCheckout(input);
};

export const midtransStatusToPaymentStatus = (
  transactionStatus: string,
  fraudStatus?: string,
) => {
  const normalized = transactionStatus.toLowerCase();
  if (normalized === "settlement") return PaymentStatus.PAID;
  if (normalized === "capture" && fraudStatus?.toLowerCase() === "accept") return PaymentStatus.PAID;
  if (normalized === "expire") return PaymentStatus.EXPIRED;
  if (normalized === "cancel") return PaymentStatus.CANCELED;
  if (normalized === "deny") return PaymentStatus.FAILED;
  return PaymentStatus.PENDING;
};

export const duitkuStatusToPaymentStatus = (resultCode: string) => {
  if (resultCode === "00") return PaymentStatus.PAID;
  if (resultCode === "01") return PaymentStatus.PENDING;
  if (resultCode === "02") return PaymentStatus.EXPIRED;
  return PaymentStatus.FAILED;
};

export const verifyMidtransSignature = (payload: Record<string, unknown>) => {
  const serverKey = safeString(process.env.MIDTRANS_SERVER_KEY);
  if (!serverKey) return false;
  const orderId = safeString(payload.order_id);
  const statusCode = safeString(payload.status_code);
  const grossAmount = safeString(payload.gross_amount);
  const signature = safeString(payload.signature_key).toLowerCase();
  if (!orderId || !statusCode || !grossAmount || !signature) return false;
  const calculated = toSha512(`${orderId}${statusCode}${grossAmount}${serverKey}`);
  return calculated.toLowerCase() === signature;
};

export const verifyDuitkuSignature = (payload: Record<string, unknown>) => {
  const merchantCode = safeString(process.env.DUITKU_MERCHANT_CODE);
  const apiKey = safeString(process.env.DUITKU_API_KEY);
  if (!merchantCode || !apiKey) return false;
  const amount = safeString(payload.amount);
  const orderId = safeString(payload.merchantOrderId);
  const signature = safeString(payload.signature).toLowerCase();
  if (!amount || !orderId || !signature) return false;
  const calculated = toMd5(`${merchantCode}${amount}${orderId}${apiKey}`);
  return calculated.toLowerCase() === signature;
};

export const verifyPakkasirSignature = (payload: Record<string, unknown>) => {
  const secret = safeString(process.env.PAKKASIR_WEBHOOK_SECRET);
  if (!secret) return true;
  const orderId = safeString(payload.orderId);
  const status = safeString(payload.status);
  const signature = safeString(payload.signature).toLowerCase();
  if (!orderId || !status || !signature) return false;
  const calculated = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}:${status}`)
    .digest("hex");
  return calculated.toLowerCase() === signature;
};

const fetchMidtransStatus = async (orderId: string) => {
  const serverKey = safeString(process.env.MIDTRANS_SERVER_KEY);
  if (!serverKey) throw new Error("Missing MIDTRANS_SERVER_KEY");
  const apiBase =
    safeString(process.env.MIDTRANS_API_BASE_URL) ||
    "https://api.sandbox.midtrans.com";

  const res = await fetch(`${apiBase}/v2/${orderId}/status`, {
    headers: { Authorization: toBasicAuth(serverKey) },
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error("Midtrans status check failed");
  const transactionStatus = safeString(data.transaction_status);
  const fraudStatus = safeString(data.fraud_status);
  return {
    status: midtransStatusToPaymentStatus(transactionStatus, fraudStatus),
    rawResponse: data,
    paidAt:
      midtransStatusToPaymentStatus(transactionStatus, fraudStatus) === PaymentStatus.PAID
        ? new Date()
        : null,
  };
};

const fetchDuitkuStatus = async (orderId: string) => {
  const merchantCode = safeString(process.env.DUITKU_MERCHANT_CODE);
  const apiKey = safeString(process.env.DUITKU_API_KEY);
  if (!merchantCode || !apiKey) throw new Error("Missing DUITKU credentials");

  const endpoint =
    safeString(process.env.DUITKU_STATUS_URL) ||
    "https://sandbox.duitku.com/webapi/api/merchant/transactionStatus";
  const signature = toMd5(`${merchantCode}${orderId}${apiKey}`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ merchantCode, merchantOrderId: orderId, signature }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error("Duitku status check failed");
  const resultCode = safeString(data.statusCode || data.resultCode);
  const status = duitkuStatusToPaymentStatus(resultCode || "01");
  return {
    status,
    rawResponse: data,
    paidAt: status === PaymentStatus.PAID ? new Date() : null,
  };
};

export const fetchProviderStatus = async (provider: PaymentProvider, orderId: string) => {
  if (provider === PaymentProvider.MIDTRANS) return fetchMidtransStatus(orderId);
  if (provider === PaymentProvider.DUITKU) return fetchDuitkuStatus(orderId);
  return { status: PaymentStatus.PENDING, rawResponse: null, paidAt: null };
};
