import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

export function runEnvSyncBuild(frameworkName: string) {
  let cliPath = "";
  
  try {
    // This will be shimmed by tsup in ESM builds and works natively in CJS.
    // In dist/plugins/utils.js, __dirname is dist/plugins.
    const relativeCli = path.resolve(__dirname, "../cli.js");
    if (fs.existsSync(relativeCli)) {
      cliPath = relativeCli;
    }
  } catch (e) {}

  if (!cliPath || !fs.existsSync(cliPath)) {
    // Fallback if installed in node_modules
    cliPath = path.resolve(process.cwd(), "node_modules/envsync/dist/cli.js");
  }

  if (!fs.existsSync(cliPath)) {
    // Local development fallback
    cliPath = path.resolve(process.cwd(), "dist/cli.js");
  }

  try {
    if (fs.existsSync(cliPath)) {
      // Execute the JS file directly with Node
      execFileSync(process.execPath, [cliPath, "build"], { stdio: "inherit" });
    } else {
      // Last resort: npx
      const npmCmd = process.platform === "win32" ? "npx.cmd" : "npx";
      execFileSync(npmCmd, ["envsync", "build"], { stdio: "inherit" });
    }
  } catch (e: any) {
    throw new Error(`[EnvSync] Build failed during ${frameworkName} startup. Fix your environment configuration before starting the server.\n${e?.message ?? e}`);
  }
}
