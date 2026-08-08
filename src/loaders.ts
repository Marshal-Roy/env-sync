import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { SourceDef } from "./types";

export function loadSources(sources: SourceDef[]): Record<string, string> {
  const env: Record<string, string> = {};

  // Load from sources in order, later sources override earlier ones
  for (const source of sources) {
    if (source.type === "process") {
      Object.assign(env, process.env);
    } else if (source.type === "dotenv") {
      const dotenvPath = source.path ? path.resolve(source.path) : path.resolve(process.cwd(), ".env");
      if (fs.existsSync(dotenvPath)) {
        const parsed = dotenv.parse(fs.readFileSync(dotenvPath, "utf-8"));
        Object.assign(env, parsed);
      }
    } else if (source.type === "external") {
      if (source.path) {
        const externalPath = path.resolve(source.path);
        if (fs.existsSync(externalPath)) {
          const content = fs.readFileSync(externalPath, "utf-8");
          // Assume simple KEY=VALUE or similar to dotenv for external files, or JSON
          try {
            if (externalPath.endsWith(".json")) {
              const parsed = JSON.parse(content);
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                  env[k] = String(v);
                }
              }
            } else {
              const parsed = dotenv.parse(content);
              Object.assign(env, parsed);
            }
          } catch (e) {
            // Silently ignore or we could log a warning
          }
        }
      }
    }
  }

  return env;
}
