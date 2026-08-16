// ─── Phase 9: shared API helpers (pagination, errors, periods) ──────
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults = { page: 1, pageSize: 50, max: 200 }
) {
  const page = Math.max(
    1,
    parseInt(searchParams.get("page") ?? String(defaults.page), 10) || defaults.page
  );
  const pageSize = Math.min(
    defaults.max,
    Math.max(
      1,
      parseInt(searchParams.get("pageSize") ?? String(defaults.pageSize), 10) ||
        defaults.pageSize
    )
  );
  const sort = searchParams.get("sort") ?? "createdAt";
  const order = (searchParams.get("order") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, sort, order };
}

export function paginated<T>(data: T[], total: number, page: number, pageSize: number) {
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: ApiError | Error, status = 500) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Internal server error" }, { status });
}

/** Current UTC billing period key, YYYY-MM. */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthsAgoPeriod(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Minor-unit formatting (cents/kobo → "12.99"). */
export function minorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}
