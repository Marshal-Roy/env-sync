import type { Plugin } from "vite";
import fs from "fs";
import path from "path";
import { runEnvSyncBuild } from "./utils";

export interface VitePluginOptions {
  configPath?: string;
}

let isWatcherStarted = false;

export function envsyncVitePlugin(options: VitePluginOptions = {}): Plugin {
  return {
    name: "envsync-vite",
    config() {
      // Run validation and code-gen during build and dev synchronously
      runEnvSyncBuild("Vite");
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
