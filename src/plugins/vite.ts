import type { Plugin } from "vite";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

export interface VitePluginOptions {
  configPath?: string;
}

export function envsyncVitePlugin(options: VitePluginOptions = {}): Plugin {
  return {
    name: "envsync",
    configResolved() {
      // Run the envsync build process synchronously to ensure envs are built before Vite proceeds
      const cliPath = path.resolve(process.cwd(), "node_modules/.bin/envsync");
      try {
        if (fs.existsSync(cliPath)) {
          execFileSync(process.execPath, [cliPath, "build"], { stdio: "inherit" });
        } else {
          // Fallback if the local binary isn't linked yet (e.g., inside the monorepo)
          const localCli = path.resolve(process.cwd(), "dist/cli.js");
          if (fs.existsSync(localCli)) {
            execFileSync(process.execPath, [localCli, "build"], { stdio: "inherit" });
          }
        }
      } catch (e) {
        console.error("❌ EnvSync build failed. Vite startup aborted.");
        process.exit(1);
      }
    },
    configureServer(server) {
      // In dev mode, start the watcher
      const watchPath = path.resolve(process.cwd(), "dist/watch.js");
      if (fs.existsSync(watchPath)) {
        import("file://" + watchPath).then(({ EnvSyncWatcher }) => {
          const watcher = new EnvSyncWatcher(options);
          watcher.on("rebuild", () => {
            // Send full-reload signal to Vite client
            server.ws.send({ type: "full-reload" });
          });
          watcher.on("error", () => {
            // We could optionally send an error overlay to vite
          });
          watcher.start();
        }).catch(err => {
          console.error("Failed to load EnvSync watcher", err);
        });
      }
    }
  };
}
