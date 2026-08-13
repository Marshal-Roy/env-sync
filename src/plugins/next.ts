import type { NextConfig } from "next";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

export interface NextPluginOptions {
  configPath?: string;
}

let isWatcherStarted = false;

export function envsyncNextPlugin(options: NextPluginOptions = {}) {
  return (nextConfig: NextConfig): NextConfig => {
    // Run validation and code-gen during build and dev synchronously
    const cliPath = path.resolve(process.cwd(), "node_modules/.bin/envsync");
    try {
      if (fs.existsSync(cliPath)) {
        execFileSync(process.execPath, [cliPath, "build"], { stdio: "inherit" });
      } else {
        const localCli = path.resolve(process.cwd(), "dist/cli.js");
        if (fs.existsSync(localCli)) {
          execFileSync(process.execPath, [localCli, "build"], { stdio: "inherit" });
        }
      }
    } catch (e) {
      console.error("❌ EnvSync build failed. Next.js startup aborted.");
      process.exit(1);
    }

    // Return the updated next config
    return {
      ...nextConfig,
      turbopack: (nextConfig as any)?.turbopack ?? {},
      webpack: (config, context) => {
        if (context.dev && context.isServer && !isWatcherStarted) {
          isWatcherStarted = true;
          // In dev mode, run the watcher
          import("../watch").then(({ EnvSyncWatcher }) => {
            if (EnvSyncWatcher) {
              const watcher = new EnvSyncWatcher(options);
              watcher.start();
            }
          }).catch(() => {
            // Ignore watcher import errors in subprocesses
          });
        }
        
        if (typeof nextConfig.webpack === "function") {
          return nextConfig.webpack(config, context);
        }
        return config;
      }
    };
  };
}
