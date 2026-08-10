import type { NextConfig } from "next";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export interface NextPluginOptions {
  configPath?: string;
}

export function envsyncNextPlugin(options: NextPluginOptions = {}) {
  return (nextConfig: NextConfig): NextConfig => {
    // Run validation and code-gen during build and dev synchronously
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
      console.error("❌ EnvSync build failed. Next.js startup aborted.");
      process.exit(1);
    }

    // Return the updated next config
    return {
      ...nextConfig,
      webpack: (config, context) => {
        if (context.dev && context.isServer) {
          // In dev mode, run the watcher inside the webpack lifecycle
          const watchPath = path.resolve(process.cwd(), "dist/watch.js");
          if (fs.existsSync(watchPath)) {
            import("file://" + watchPath).then(({ EnvSyncWatcher }) => {
              const watcher = new EnvSyncWatcher(options);
              watcher.start();
            }).catch(err => {
              console.error("Failed to load EnvSync watcher in Next.js", err);
            });
          }
        }
        
        if (typeof nextConfig.webpack === "function") {
          return nextConfig.webpack(config, context);
        }
        return config;
      }
    };
  };
}
