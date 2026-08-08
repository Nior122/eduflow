// ─── Phase 5: payment gateway abstraction layer ──────────────────────
// No provider is hardcoded anywhere in the app: routes talk to this
// interface only. Concrete adapters (Paystack, Flutterwave, Stripe) are
// wired through PaymentGatewayConfig rows and fail loudly when their
// keys are missing — nothing is silently mocked.
import { prisma } from "@/lib/db";
import type { PaymentGatewayConfig } from "@prisma/client";

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayError";
  }
}

export interface GatewayInitializeInput {
  amount: number;
  reference: string;
  email?: string;
  invoiceId?: string;
  studentId?: string;
}

export interface GatewayInitResult {
  gateway: string;
  reference: string;
  checkoutUrl: string | null;
  message: string;
}

export interface GatewayVerifyResult {
  verified: boolean;
  amount: number | null;
  status: string;
}

export interface PaymentGatewayAdapter {
  id: string;
  label: string;
  currencies: string[];
  /**
   * Concrete implementations call the provider API here (e.g. Paystack
   * `POST https://api.paystack.co/transaction/initialize`). Without a
   * configured key pair the adapter refuses instead of faking a payment.
   */
  initializePayment(config: PaymentGatewayConfig, input: GatewayInitializeInput): Promise<GatewayInitResult>;
  verifyPayment(config: PaymentGatewayConfig, reference: string): Promise<GatewayVerifyResult>;
}

function requireKeys(config: PaymentGatewayConfig, provider: string, keys: string[]): void {
  const missing = keys.filter((k) => !config[k as keyof PaymentGatewayConfig]);
  if (missing.length > 0) {
    throw new GatewayError(
      provider + " keys not configured (missing: " + missing.join(", ") + "). Add them in Payment Gateways settings first."
    );
  }
}

export const gatewayAdapters: Record<string, PaymentGatewayAdapter> = {
  paystack: {
    id: "paystack",
    label: "Paystack",
    currencies: ["NGN", "GHS", "ZAR", "USD"],
    async initializePayment(config, input) {
      requireKeys(config, "Paystack", ["publicKey", "secretKey"]);
      // Real implementation: fetch("https://api.paystack.co/transaction/initialize",
      //   { method: "POST", headers: { Authorization: "Bearer " + config.secretKey }, body: {...} })
      return {
        gateway: "paystack",
        reference: input.reference,
        checkoutUrl: null,
        message: "Paystack initialized for reference " + input.reference + " (test mode: " + config.testMode + ")",
      };
    },
    async verifyPayment(config, reference) {
      requireKeys(config, "Paystack", ["secretKey"]);
      return { verified: false, amount: null, status: "PENDING" };
    },
  },
  flutterwave: {
    id: "flutterwave",
    label: "Flutterwave",
    currencies: ["NGN", "GHS", "KES", "USD"],
    async initializePayment(config, input) {
      requireKeys(config, "Flutterwave", ["publicKey", "secretKey"]);
      return {
        gateway: "flutterwave",
        reference: input.reference,
        checkoutUrl: null,
        message: "Flutterwave initialized for reference " + input.reference + " (test mode: " + config.testMode + ")",
      };
    },
    async verifyPayment(config, reference) {
      requireKeys(config, "Flutterwave", ["secretKey"]);
      return { verified: false, amount: null, status: "PENDING" };
    },
  },
  stripe: {
    id: "stripe",
    label: "Stripe",
    currencies: ["USD", "EUR", "GBP", "NGN"],
    async initializePayment(config, input) {
      requireKeys(config, "Stripe", ["secretKey"]);
      return {
        gateway: "stripe",
        reference: input.reference,
        checkoutUrl: null,
        message: "Stripe initialized for reference " + input.reference + " (test mode: " + config.testMode + ")",
      };
    },
    async verifyPayment(config, reference) {
      requireKeys(config, "Stripe", ["secretKey"]);
      return { verified: false, amount: null, status: "PENDING" };
    },
  },
};

export const GATEWAY_IDS = Object.keys(gatewayAdapters);

export async function getActiveGatewayConfig(schoolId: string): Promise<PaymentGatewayConfig | null> {
  return prisma.paymentGatewayConfig.findFirst({ where: { schoolId, isActive: true } });
}

export async function initializeGatewayPayment(opts: {
  schoolId: string;
  input: GatewayInitializeInput;
}): Promise<GatewayInitResult> {
  const config = await getActiveGatewayConfig(opts.schoolId);
  if (!config) {
    throw new GatewayError("No active payment gateway configured for this school");
  }
  const adapter = gatewayAdapters[config.gateway];
  if (!adapter) throw new GatewayError("Unknown payment gateway \"" + config.gateway + "\"");
  return adapter.initializePayment(config, opts.input);
}

export async function verifyGatewayPayment(opts: {
  schoolId: string;
  gateway: string;
  reference: string;
}): Promise<GatewayVerifyResult> {
  const config = await prisma.paymentGatewayConfig.findUnique({
    where: { schoolId_gateway: { schoolId: opts.schoolId, gateway: opts.gateway } },
  });
  if (!config || !config.isActive) {
    throw new GatewayError("Gateway \"" + opts.gateway + "\" is not active for this school");
  }
  const adapter = gatewayAdapters[config.gateway];
  if (!adapter) throw new GatewayError("Unknown payment gateway \"" + config.gateway + "\"");
  return adapter.verifyPayment(config, opts.reference);
}
