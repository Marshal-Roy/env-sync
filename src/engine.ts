import pc from "picocolors";
import { SchemaConfig, SourceDef, ValidationResult, ValidationError, ValidationContext } from "./types";
import { coerceValue } from "./coercion";
import { validateField } from "./validation";
import { loadSources } from "./loaders";

export function validateSchema(config: SchemaConfig, sources?: SourceDef[]): { server: ValidationResult, client: ValidationResult, success: boolean } {
  // Default sources if not provided
  const activeSources = sources || config.sources || [
    { type: "dotenv" },
    { type: "process" }
  ];

  const rawEnv = loadSources(activeSources);
  const serverResult: ValidationResult = { valid: true, errors: [], data: {} };
  const clientResult: ValidationResult = { valid: true, errors: [], data: {} };

  const framework = config.framework || "none";
  const autoPrefix = config.autoPrefix ?? false;

  // Validate Server
  if (config.server) {
    for (const [key, def] of Object.entries(config.server)) {
      const rawValue = rawEnv[key];
      const coercedValue = coerceValue(rawValue, def);
      const ctx: ValidationContext = {
        key,
        value: coercedValue,
        def,
        isClient: false,
        framework,
        autoPrefix,
      };

      const errors = validateField(ctx);
      if (errors.length > 0) {
        serverResult.valid = false;
        serverResult.errors.push(...errors);
      } else if (coercedValue !== undefined) {
        serverResult.data[key] = coercedValue;
      }
    }
  }

  // Validate Client
  if (config.client) {
    for (const [key, def] of Object.entries(config.client)) {
      // If autoPrefix is enabled, we read from rawEnv using the prefixed key
      let lookupKey = key;
      if (autoPrefix && framework !== "none") {
        const prefixMap: Record<string, string> = {
          nextjs: "NEXT_PUBLIC_",
          vite: "VITE_",
          cra: "REACT_APP_",
          sveltekit: "PUBLIC_",
          nuxt: "NUXT_PUBLIC_",
        };
        const prefix = prefixMap[framework];
        if (prefix && !key.startsWith(prefix)) {
          lookupKey = `${prefix}${key}`;
        }
      }

      const rawValue = rawEnv[lookupKey];
      const coercedValue = coerceValue(rawValue, def);
      const ctx: ValidationContext = {
        key, // the key defined in schema
        value: coercedValue,
        def,
        isClient: true,
        framework,
        autoPrefix,
      };

      const errors = validateField(ctx);
      if (errors.length > 0) {
        clientResult.valid = false;
        clientResult.errors.push(...errors);
      } else if (coercedValue !== undefined) {
        clientResult.data[key] = coercedValue;
      }
    }
  }

  return {
    server: serverResult,
    client: clientResult,
    success: serverResult.valid && clientResult.valid,
  };
}

export function printErrors(serverErrors: ValidationError[], clientErrors: ValidationError[]) {
  if (serverErrors.length > 0) {
    console.error(pc.red(pc.bold("\n❌ Server Environment Validation Errors:")));
    for (const err of serverErrors) {
      console.error(pc.red(`  - [${err.key}]: ${err.message}`));
    }
  }

  if (clientErrors.length > 0) {
    console.error(pc.red(pc.bold("\n❌ Client Environment Validation Errors:")));
    for (const err of clientErrors) {
      console.error(pc.red(`  - [${err.key}]: ${err.message}`));
    }
  }
}
