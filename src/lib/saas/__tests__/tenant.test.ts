import { describe, expect, it } from "vitest";
import { assertTenantAccess, requireSchoolContext, type TenantSession } from "../tenant";

const adminA: TenantSession = { userId: "u1", role: "SCHOOL_ADMIN", schoolId: "school-a" };
const superAdmin: TenantSession = { userId: "u9", role: "SUPER_ADMIN", schoolId: null };

describe("assertTenantAccess", () => {
  it("allows the school's own admin", () => {
    expect(assertTenantAccess(adminA, "school-a")).toBeNull();
  });

  it("blocks cross-tenant access (School B reading School A)", () => {
    const res = assertTenantAccess({ ...adminA, schoolId: "school-b" }, "school-a");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("blocks anonymous access", () => {
    const res = assertTenantAccess(null, "school-a");
    expect(res!.status).toBe(401);
  });

  it("blocks access without a target school", () => {
    const res = assertTenantAccess(adminA, null);
    expect(res!.status).toBe(403);
  });

  it("lets SUPER_ADMIN operate across tenants", () => {
    expect(assertTenantAccess(superAdmin, "school-a")).toBeNull();
    expect(assertTenantAccess(superAdmin, "school-b")).toBeNull();
  });
});

describe("requireSchoolContext", () => {
  it("rejects SUPER_ADMIN without a school context", () => {
    const res = requireSchoolContext(superAdmin);
    expect(res!.status).toBe(403);
  });

  it("accepts a school-scoped session", () => {
    expect(requireSchoolContext(adminA)).toBeNull();
  });

  it("rejects anonymous", () => {
    expect(requireSchoolContext(null)!.status).toBe(401);
  });
});
