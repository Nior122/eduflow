import { NextResponse } from "next/server";

/**
 * GET /api/v1/openapi.json — machine-readable spec for the versioned API.
 * Source of truth: docs/API.md (kept in sync manually).
 */
const spec = {
  openapi: "3.0.3",
  info: {
    title: "EduFlow REST API v1",
    version: "1.0.0",
    description: "Tenant-scoped school data API. Authenticate with an API key in the `x-api-key` header (manage keys in Admin → API Keys). All responses are scoped to the key's school — cross-tenant access is impossible by construction.",
  },
  servers: [{ url: "https://app.eduflow.com/api/v1" }],
  security: [{ ApiKey: [] }],
  components: {
    securitySchemes: {
      ApiKey: { type: "apiKey", in: "header", name: "x-api-key" },
    },
    schemas: {
      Meta: {
        type: "object",
        properties: {
          page: { type: "integer" },
          pageSize: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      Student: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          admissionNumber: { type: "string" },
          classId: { type: ["string", "null"] },
        },
      },
      Error: { type: "object", properties: { error: { type: "string" } } },
    },
  },
  paths: {
    "/school": {
      get: {
        summary: "School profile + plan",
        responses: { "200": { description: "School profile" }, "401": { $ref: "#/components/schemas/Error" } },
      },
    },
    "/students": {
      get: {
        summary: "List students",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "sort", in: "query", schema: { type: "string", default: "createdAt" } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
          { name: "classId", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Paginated students", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Student" } }, meta: { $ref: "#/components/schemas/Meta" } } } } } },
        },
      },
      post: {
        summary: "Create student",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["firstName", "lastName"], properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" }, classId: { type: "string" } } } } } },
        responses: { "201": { description: "Created" }, "403": { description: "Plan limit reached" }, "409": { description: "Duplicate" } },
      },
    },
    "/teachers": {
      get: {
        summary: "List teachers",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "pageSize", in: "query", schema: { type: "integer" } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated teachers" } },
      },
      post: {
        summary: "Create teacher",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["firstName", "lastName", "email"], properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" } } } } } },
        responses: { "201": { description: "Created" }, "403": { description: "Plan limit reached" } },
      },
    },
    "/classes": {
      get: {
        summary: "List classes",
        responses: { "200": { description: "Paginated classes" } },
      },
    },
    "/results": {
      get: {
        summary: "List results",
        parameters: [
          { name: "studentId", in: "query", schema: { type: "string" } },
          { name: "classId", in: "query", schema: { type: "string" } },
          { name: "subjectId", in: "query", schema: { type: "string" } },
          { name: "term", in: "query", schema: { type: "string" } },
          { name: "session", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated results" } },
      },
    },
    "/fees": {
      get: {
        summary: "List fee types",
        responses: { "200": { description: "Paginated fees" } },
      },
    },
    "/attendance": {
      get: {
        summary: "List attendance",
        parameters: [
          { name: "date", in: "query", schema: { type: "string", example: "2026-08-12" } },
          { name: "classId", in: "query", schema: { type: "string" } },
          { name: "studentId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated attendance" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
