import type { Config } from "payload";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export interface PayloadPluginOptions {
  configPath?: string;
}

export function envsyncPayloadPlugin(options: PayloadPluginOptions = {}) {
  return (config: Config): Config => {
    // Validate on startup
    const cliPath = path.resolve(process.cwd(), "node_modules/.bin/envsync");
    try {
      if (fs.existsSync(cliPath)) {
        execSync(`${cliPath} build`, { stdio: "inherit" });
      } else {
        const localCli = path.resolve(process.cwd(), "dist/cli.js");
        if (fs.existsSync(localCli)) {
           execSync(`node ${localCli} build`, { stdio: "inherit" });
        }
      }
    } catch (e) {
      console.error("❌ EnvSync build failed. Payload startup aborted.");
      process.exit(1);
    }

    // Pass the payload config through
    return config;
  };
}
