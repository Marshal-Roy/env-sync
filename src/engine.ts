import pc from "picocolors";
import { SchemaConfig, SourceDef, ValidationResult, ValidationError, ValidationWarning, ValidationContext } from "./types";
import { coerceValue } from "./coercion";
import { validateField, validateMetadata } from "./validation";
import { loadSources } from "./loaders";

export function validateSchema(config: SchemaConfig, sources?: SourceDef[]): { server: ValidationResult, client: ValidationResult, success: boolean } {
  // Default sources if not provided
  const activeSources = sources || config.sources || [
    { type: "dotenv" },
    { type: "process" }
  ];

  const rawEnv = loadSources(activeSources);
  const serverResult: ValidationResult = { valid: true, errors: [], warnings: [], data: {} };
  const clientResult: ValidationResult = { valid: true, errors: [], warnings: [], data: {} };

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

      const warnings = validateMetadata(key, def);
      if (warnings.length > 0) {
        serverResult.warnings.push(...warnings);
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

      const warnings = validateMetadata(key, def);
      if (warnings.length > 0) {
        clientResult.warnings.push(...warnings);
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

export function printWarnings(serverWarnings: ValidationWarning[], clientWarnings: ValidationWarning[]) {
  if (serverWarnings.length > 0) {
    console.warn(pc.yellow(pc.bold("\n⚠️ Server Environment Warnings:")));
    for (const warn of serverWarnings) {
      console.warn(pc.yellow(`  - [${warn.key}]: ${warn.message}`));
    }
  }

  if (clientWarnings.length > 0) {
    console.warn(pc.yellow(pc.bold("\n⚠️ Client Environment Warnings:")));
    for (const warn of clientWarnings) {
      console.warn(pc.yellow(`  - [${warn.key}]: ${warn.message}`));
    }
  }
}

import jiti from "jiti";
import path from "path";
import fs from "fs";

export function loadEnv(configPath?: string) {
  const p = configPath || path.resolve(process.cwd(), "envsync.config.ts");
  if (!fs.existsSync(p)) {
    throw new Error(`❌ envsync.config.ts not found at ${p}`);
  }
  const loadConfig = jiti(process.cwd(), { interopDefault: true });
  const config = loadConfig(p) as SchemaConfig;
  const { server, client, success } = validateSchema(config);
  
  // Print warnings if any exist, even if validation succeeds
  printWarnings(server.warnings, client.warnings);
  
  if (!success) {
    printErrors(server.errors, client.errors);
    throw new Error("❌ Environment validation failed.");
  }
  
  return { serverEnv: server.data, clientEnv: client.data };
}
