import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { SourceDef } from "./types";

/** Keys that must never be assigned to avoid prototype pollution. */
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Max bytes read from any external file to prevent accidental DoS via huge files. */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function loadSources(sources: SourceDef[]): Record<string, string> {
  const projectRoot = path.resolve(process.cwd());
  // Use Object.create(null) to ensure the accumulator has no prototype chain —
  // this eliminates prototype-pollution risk from Object.assign() merges.
  const env: Record<string, string> = Object.create(null);

  // Load from sources in order; later sources override earlier ones
  for (const source of sources) {
    if (source.type === "process") {
      for (const [k, v] of Object.entries(process.env)) {
        if (!BLOCKED_KEYS.has(k) && v !== undefined) {
          env[k] = v;
        }
      }
    } else if (source.type === "dotenv") {
      const dotenvPath = source.path
        ? path.resolve(source.path)
        : path.resolve(projectRoot, ".env");

      // Ensure resolved path stays within the project root
      if (!dotenvPath.startsWith(projectRoot + path.sep) && dotenvPath !== projectRoot) {
        throw new Error(
          `[EnvSync] dotenv source path escapes the project root: "${dotenvPath}". ` +
          `Only paths inside "${projectRoot}" are allowed.`
        );
      }

      if (fs.existsSync(dotenvPath)) {
        // Resolve symlinks before the containment check so a symlink that
        // lives inside the project root but points outside it can't escape.
        let realDotenvPath: string;
        try {
          realDotenvPath = fs.realpathSync(dotenvPath);
        } catch {
          throw new Error(`[EnvSync] Could not resolve real path for dotenv file: "${dotenvPath}"`);
        }
        if (!realDotenvPath.startsWith(projectRoot + path.sep) && realDotenvPath !== projectRoot) {
          throw new Error(
            `[EnvSync] dotenv source path resolves outside the project root (possible symlink escape): "${realDotenvPath}". ` +
            `Only paths inside "${projectRoot}" are allowed.`
          );
        }
        const stat = fs.statSync(realDotenvPath);
        if (stat.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`[EnvSync] dotenv file is too large (${stat.size} bytes): "${realDotenvPath}"`);
        }
        const parsed = dotenv.parse(fs.readFileSync(realDotenvPath, "utf-8"));
        for (const [k, v] of Object.entries(parsed)) {
          if (!BLOCKED_KEYS.has(k)) {
            env[k] = v;
          }
        }
      }
    } else if (source.type === "external") {
      if (!source.path) {
        throw new Error(`[EnvSync] An "external" source must specify a "path".`);
      }

      const externalPath = path.resolve(source.path);

      // Strict project-root containment check
      if (!externalPath.startsWith(projectRoot + path.sep) && externalPath !== projectRoot) {
        throw new Error(
          `[EnvSync] External source path escapes the project root: "${externalPath}". ` +
          `Only paths inside "${projectRoot}" are allowed.`
        );
      }

      if (!fs.existsSync(externalPath)) {
        throw new Error(`[EnvSync] External source file not found: "${externalPath}"`);
      }

      // Resolve symlinks before the containment check so a symlink inside
      // the project root that points outside it cannot escape the boundary.
      let realExternalPath: string;
      try {
        realExternalPath = fs.realpathSync(externalPath);
      } catch {
        throw new Error(`[EnvSync] Could not resolve real path for external source: "${externalPath}"`);
      }
      if (!realExternalPath.startsWith(projectRoot + path.sep) && realExternalPath !== projectRoot) {
        throw new Error(
          `[EnvSync] External source path resolves outside the project root (possible symlink escape): "${realExternalPath}". ` +
          `Only paths inside "${projectRoot}" are allowed.`
        );
      }

      const stat = fs.statSync(realExternalPath);
      if (stat.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`[EnvSync] External source file is too large (${stat.size} bytes): "${realExternalPath}"`);
      }

      const content = fs.readFileSync(realExternalPath, "utf-8");

      if (realExternalPath.endsWith(".json")) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch (e: any) {
          throw new Error(`[EnvSync] Failed to parse external JSON source "${externalPath}": ${e.message}`);
        }

        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error(`[EnvSync] External JSON source "${externalPath}" must be a flat key-value object.`);
        }

        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          // Skip prototype-polluting keys
          if (BLOCKED_KEYS.has(k)) continue;
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            env[k] = String(v);
          }
        }
      } else {
        // Treat as dotenv-format file
        let parsed: Record<string, string>;
        try {
          parsed = dotenv.parse(content);
        } catch (e: any) {
          throw new Error(`[EnvSync] Failed to parse external dotenv source "${externalPath}": ${e.message}`);
        }
        for (const [k, v] of Object.entries(parsed)) {
          if (!BLOCKED_KEYS.has(k)) {
            env[k] = v;
          }
        }
      }
    }
  }

  return env;
}
