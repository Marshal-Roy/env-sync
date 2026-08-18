import type { Config } from "payload";
import { runEnvSyncBuild } from "./utils";

export interface PayloadPluginOptions {
  configPath?: string;
}

export function envsyncPayloadPlugin(options: PayloadPluginOptions = {}) {
  return (config: any) => {
    // Run validation and code-gen synchronously during startup
    runEnvSyncBuild("Payload");

    // Pass the payload config through
    return config;
  };
}
