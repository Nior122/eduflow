import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, gatewayConfigSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";
import { GATEWAY_IDS } from "@/lib/finance/gateway";

/** GET /api/finance/gateways — configured gateway rows for the school. */
export async function GET() {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const configs = await prisma.paymentGatewayConfig.findMany({ where: { schoolId } });
  return NextResponse.json({
    gateways: configs,
    available: GATEWAY_IDS,
  });
}

/**
 * POST /api/finance/gateways — upsert a gateway configuration.
 * Only one gateway may be active at a time (enforced here).
 */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await req.json();
    const parsed = validate(gatewayConfigSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const config = await prisma.$transaction(async (tx) => {
      if (data.isActive) {
        await tx.paymentGatewayConfig.updateMany({
          where: { schoolId, isActive: true },
          data: { isActive: false },
        });
      }
      return tx.paymentGatewayConfig.upsert({
        where: { schoolId_gateway: { schoolId, gateway: data.gateway } },
        update: {
          isActive: data.isActive,
          publicKey: data.publicKey ?? undefined,
          secretKey: data.secretKey ?? undefined,
          webhookSecret: data.webhookSecret ?? undefined,
          testMode: data.testMode,
        },
        create: {
          schoolId,
          gateway: data.gateway,
          isActive: data.isActive,
          publicKey: data.publicKey ?? null,
          secretKey: data.secretKey ?? null,
          webhookSecret: data.webhookSecret ?? null,
          testMode: data.testMode,
        },
      });
    });

    await logFinanceAudit({
      actorId: g.session?.user?.id ?? null,
      action: "GATEWAY_UPDATE",
      entity: "PaymentGatewayConfig",
      entityId: config.id,
      newValue: { gateway: config.gateway, isActive: config.isActive, testMode: config.testMode },
    });
    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error("Failed to save gateway config:", error);
    return NextResponse.json({ error: "Failed to save gateway config" }, { status: 500 });
  }
}
