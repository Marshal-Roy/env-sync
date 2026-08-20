import chokidar, { FSWatcher } from "chokidar";
import { EventEmitter } from "events";
import pc from "picocolors";
import fs from "fs";
import path from "path";
import { generateServerEnv, generateClientEnv } from "./generator";
import { validateSchema, printErrors, printWarnings } from "./engine";
import { SchemaConfig, ValidationResult } from "./types";
// using jiti for config loading
import jiti from "jiti";

export interface WatcherOptions {
  cwd?: string;
  configPath?: string;
  outDir?: string;
}

export class EnvSyncWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private options: WatcherOptions;
  private previousData: Record<string, any> = {};

  constructor(options: WatcherOptions = {}) {
    super();
    this.options = {
      cwd: options.cwd || process.cwd(),
      configPath: options.configPath || path.resolve(options.cwd || process.cwd(), "envsync.config.ts"),
      outDir: options.outDir || path.resolve(options.cwd || process.cwd(), "src/config"),
    };
  }

  public async start() {
    const { cwd, configPath } = this.options;
    
    // We will watch the config file and any .env files we can find
    // For now, watch envsync.config.ts and .env, .env.local, etc.
    const watchPaths = [
      configPath!,
      path.resolve(cwd!, ".env"),
      path.resolve(cwd!, ".env.local"),
      path.resolve(cwd!, ".env.development"),
      path.resolve(cwd!, ".env.production"),
      path.resolve(cwd!, ".env.test"),
    ];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles (except .env which are explicitly added)
      persistent: true,
      ignoreInitial: true,
    });

    console.log(pc.blue("👀 Watching for environment changes..."));

    // Do an initial build
    this.rebuild();

    this.watcher.on("change", (changedPath: string) => {
      console.log(pc.yellow(`\nFile changed: ${path.basename(changedPath)}`));
      this.rebuild();
    });

    this.watcher.on("add", (addedPath: string) => {
      console.log(pc.green(`\nFile added: ${path.basename(addedPath)}`));
      this.rebuild();
    });
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }

  private rebuild() {
    const { configPath, outDir } = this.options;
    if (!fs.existsSync(configPath!)) {
      console.error(pc.red("❌ envsync.config.ts not found."));
      return;
    }

    try {
      // Create a fresh jiti instance that explicitly disables caching
      const loadConfig = jiti(process.cwd(), { interopDefault: true, requireCache: false });
      
      const config = loadConfig(configPath!) as SchemaConfig;
      const { server, client, success } = validateSchema(config);
      
      printWarnings(server.warnings, client.warnings);
      
      if (!success) {
        printErrors(server.errors, client.errors);
        if (this.listenerCount("error") > 0) {
          this.emit("error", { serverErrors: server.errors, clientErrors: client.errors });
        }
        return;
      }

      generateServerEnv(config, outDir!, configPath!);
      generateClientEnv(config, outDir!, configPath!);
      
      // Calculate diff
      const newData = { ...server.data, ...client.data };
      this.printDiff(this.previousData, newData);
      this.previousData = newData;

      this.emit("rebuild", { server, client });
      console.log(pc.green("✅ Environment types updated successfully!"));
      
    } catch (e: any) {
      console.error(pc.red("❌ Failed to rebuild environment"));
      console.error(e.message);
      if (this.listenerCount("error") > 0) {
        this.emit("error", e);
      }
    }
  }

  private printDiff(oldData: Record<string, any>, newData: Record<string, any>) {
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    const oldKeys = Object.keys(oldData);
    const newKeys = Object.keys(newData);

    for (const key of newKeys) {
      if (!oldKeys.includes(key)) {
        added.push(key);
      } else if (oldData[key] !== newData[key]) {
        modified.push(key);
      }
    }

    for (const key of oldKeys) {
      if (!newKeys.includes(key)) {
        removed.push(key);
      }
    }

    if (added.length === 0 && removed.length === 0 && modified.length === 0 && Object.keys(oldData).length > 0) {
      console.log(pc.gray("No variables changed."));
    }

    if (added.length > 0) {
      console.log(pc.green(`Added: ${added.join(", ")}`));
    }
    if (modified.length > 0) {
      console.log(pc.yellow(`Modified: ${modified.join(", ")}`));
    }
    if (removed.length > 0) {
      console.log(pc.red(`Removed: ${removed.join(", ")}`));
    }
  }
}
