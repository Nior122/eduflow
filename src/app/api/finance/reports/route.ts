import { NextResponse } from "next/server";
import { financeGuard } from "@/lib/finance/guards";
import { getFinanceReport, toCSV } from "@/lib/finance/reports";

/**
 * GET /api/finance/reports
 * ?type=daily|weekly|monthly|annual|custom|outstanding|discounts|methods|cashflow|class|department
 * &from&to&sessionId&termId&classId&format=csv|json
 */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "monthly";
    const format = searchParams.get("format") ?? "json";

    const report = await getFinanceReport({
      schoolId,
      type: type as Parameters<typeof getFinanceReport>[0]["type"],
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      sessionId: searchParams.get("sessionId"),
      termId: searchParams.get("termId"),
      classId: searchParams.get("classId"),
    });

    if (format === "csv") {
      const csv = toCSV(report.columns, report.rows);
      const filename = `eduflow-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Report generation failed:", error);
    return NextResponse.json({ error: "Report generation failed" }, { status: 400 });
  }
}
