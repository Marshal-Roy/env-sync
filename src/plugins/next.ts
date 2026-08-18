import type { NextConfig } from "next";
import { runEnvSyncBuild } from "./utils";

export interface NextPluginOptions {
  configPath?: string;
}

let isWatcherStarted = false;

export function envsyncNextPlugin(options: NextPluginOptions = {}) {
  return (nextConfig: NextConfig): NextConfig => {
    // Run validation and code-gen during build and dev synchronously
    runEnvSyncBuild("Next.js");

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
