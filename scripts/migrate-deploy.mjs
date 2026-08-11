/**
 * EduFlow — production migrate step.
 * Runs `prisma migrate deploy` against a DIRECT Postgres connection.
 *
 * Neon pooled connection strings (host contains "-pooler") cannot be
 * used by Prisma Migrate, so the direct connection is required. Uses
 * DIRECT_URL when set; otherwise derives the direct host from
 * DATABASE_URL by stripping the "-pooler" marker (the documented Neon
 * convention: <project>-pooler.<region>.neon.tech -> <project>.<region>).
 */
import { execSync } from "node:child_process";

const explicit = process.env.DIRECT_URL;
const databaseUrl = process.env.DATABASE_URL ?? "";
const isPooled = databaseUrl.includes("-pooler.");
const directUrl = explicit || (isPooled ? databaseUrl.replace("-pooler.", ".") : databaseUrl);

if (!directUrl) {
  console.error("migrate-deploy: neither DIRECT_URL nor DATABASE_URL is set.");
  process.exit(1);
}
if (!explicit) {
  console.log(
    isPooled
      ? "migrate-deploy: derived DIRECT_URL from DATABASE_URL (removed -pooler)"
      : "migrate-deploy: using DATABASE_URL as the direct connection"
  );
}

process.env.DIRECT_URL = directUrl;
execSync("prisma migrate deploy", { stdio: "inherit" });
