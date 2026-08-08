import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateSchema } from "../src/engine";
import { SchemaConfig } from "../src/types";

describe("Engine - validateSchema", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost:5432");
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
  });

  it("should validate basic server and client schema correctly", () => {
    const config: SchemaConfig = {
      server: {
        DATABASE_URL: { type: "string", required: true },
        PORT: { type: "number", default: 8080 },
      },
      client: {
        NEXT_PUBLIC_API_URL: { type: "url", required: true },
      },
    };

    const result = validateSchema(config, [{ type: "process" }]);
    expect(result.success).toBe(true);
    expect(result.server.data.DATABASE_URL).toBe("postgres://localhost:5432");
    expect(result.server.data.PORT).toBe(3000); // Coerced to number
    expect(result.client.data.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
  });

  it("should fail validation on missing required fields", () => {
    const config: SchemaConfig = {
      server: {
        MISSING_VAR: { type: "string", required: true },
      },
    };

    const result = validateSchema(config, [{ type: "process" }]);
    expect(result.success).toBe(false);
    expect(result.server.errors.length).toBe(1);
    expect(result.server.errors[0].message).toContain("Missing required variable: MISSING_VAR");
  });

  it("should enforce prefix when framework is specified", () => {
    const config: SchemaConfig = {
      framework: "nextjs",
      client: {
        INVALID_CLIENT_VAR: { type: "string" },
      },
    };

    const result = validateSchema(config, [{ type: "process" }]);
    expect(result.success).toBe(false);
    expect(result.client.errors[0].message).toContain("missing the required \"NEXT_PUBLIC_\" prefix");
  });

  it("should work with autoPrefix correctly", () => {
    vi.stubEnv("VITE_APP_TITLE", "My App");
    const config: SchemaConfig = {
      framework: "vite",
      autoPrefix: true,
      client: {
        APP_TITLE: { type: "string", required: true }, // Not prefixed in schema
      },
    };

    const result = validateSchema(config, [{ type: "process" }]);
    expect(result.success).toBe(true);
    expect(result.client.data.APP_TITLE).toBe("My App"); // Data has schema key
  });

  it("should validate enums", () => {
    vi.stubEnv("NODE_ENV", "development");
    const config: SchemaConfig = {
      server: {
        NODE_ENV: { type: "enum", values: ["production", "development", "test"] },
        BAD_ENUM: { type: "enum", values: ["yes", "no"] },
      },
    };
    vi.stubEnv("BAD_ENUM", "maybe");

    const result = validateSchema(config, [{ type: "process" }]);
    expect(result.success).toBe(false);
    expect(result.server.errors[0].message).toContain("must be one of: yes, no");
  });

  it("should use defaults if value is empty", () => {
    const config: SchemaConfig = {
      server: {
        OPTIONAL_THING: { type: "string", default: "hello" },
      },
    };

    const result = validateSchema(config, [{ type: "process" }]);
    expect(result.success).toBe(true);
    expect(result.server.data.OPTIONAL_THING).toBe("hello");
  });
});
