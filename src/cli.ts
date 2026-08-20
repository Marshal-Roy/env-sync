#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import fs from "fs";
import path from "path";
import { generateServerEnv, generateClientEnv } from "./generator";
import { validateSchema, printErrors, printWarnings } from "./engine";
import { SchemaConfig, Framework } from "./types";
import { loadSources } from "./loaders";

// We need jiti to load the ts config file
import jiti from "jiti";
const loadConfig = jiti(process.cwd(), { interopDefault: true });

const program = new Command();

program
  .name("envsync")
  .description("Type-Safe Environment Management for Modern JavaScript Applications")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold envsync configuration in your project based on existing .env or clean templates")
  .action(() => {
    console.log(pc.blue("Initializing EnvSync...\n"));

    // 1. Detect Framework
    let framework: Framework = "none";
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps.next) framework = "nextjs";
      else if (deps.vite) framework = "vite";
      else if (deps.nuxt) framework = "nuxt";
      else if (deps["@sveltejs/kit"]) framework = "sveltekit";
      else if (deps["react-scripts"]) framework = "cra";
    }

    let clientPrefix = "";
    if (framework === "nextjs") clientPrefix = "NEXT_PUBLIC_";
    if (framework === "vite") clientPrefix = "VITE_";
    if (framework === "cra") clientPrefix = "REACT_APP_";
    if (framework === "sveltekit") clientPrefix = "PUBLIC_";
    if (framework === "nuxt") clientPrefix = "NUXT_PUBLIC_";

    // 2. Read existing .env file if available
    const envPath = path.resolve(process.cwd(), ".env");
    let existingEnv: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
      const dotenv = require("dotenv");
      existingEnv = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
    } else {
      // Create an empty .env file without dummy content
      fs.writeFileSync(envPath, "", "utf-8");
      console.log(pc.green("✅ Created .env"));
    }

    // Ensure .env is listed in .gitignore to prevent accidental secret commits
    const gitignorePath = path.resolve(process.cwd(), ".gitignore");
    try {
      const existingGitignore = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, "utf-8")
        : "";
      const lines = existingGitignore.split(/\r?\n/);
      const alreadyIgnored = lines.some(l => l.trim() === ".env" || l.trim() === "*.env");
      if (!alreadyIgnored) {
        const appendContent = existingGitignore.endsWith("\n") || existingGitignore === ""
          ? ".env\n"
          : "\n.env\n";
        fs.appendFileSync(gitignorePath, appendContent, "utf-8");
        console.log(pc.green("✅ Added .env to .gitignore"));
      }
    } catch (e: any) {
      console.warn(pc.yellow(`⚠️ Could not update .gitignore: ${e.message}`));
    }

    // 3. Create envsync.config.ts
    const configPath = path.resolve(process.cwd(), "envsync.config.ts");
    if (fs.existsSync(configPath)) {
      console.log(pc.yellow("⚠️ envsync.config.ts already exists. Skipping config creation."));
    } else {
      const envKeys = Object.keys(existingEnv);
      
      const serverEntries: string[] = [];
      const clientEntries: string[] = [];

      for (const [key, value] of Object.entries(existingEnv)) {
        let inferredType = "string";
        if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
          inferredType = "boolean";
        } else if (!isNaN(Number(value)) && value.trim() !== "") {
          inferredType = "number";
        } else if (value.startsWith("http://") || value.startsWith("https://")) {
          inferredType = "url";
        }

        const entry = `    ${key}: {\n      type: "${inferredType}",\n      required: true,\n    },`;

        if (clientPrefix && key.startsWith(clientPrefix)) {
          clientEntries.push(entry);
        } else {
          serverEntries.push(entry);
        }
      }

      const serverBlock = serverEntries.length > 0
        ? serverEntries.join("\n")
        : `    /* Example Server Variable:\n    // PORT: {\n    //   type: "number",\n    //   default: 3000,\n    // },\n    */`;

      const clientBlock = clientEntries.length > 0
        ? clientEntries.join("\n")
        : `    /* Example Client Variable:\n    // ${clientPrefix || "PUBLIC_"}API_URL: {\n    //   type: "url",\n    //   required: true,\n    // },\n    */`;

      const configTemplate = `import { SchemaConfig } from "envsync";

export default {
  framework: "${framework}",
  autoPrefix: false,
  server: {
${serverBlock}
  },
  client: {
${clientBlock}
  },
} satisfies SchemaConfig;
`;
      fs.writeFileSync(configPath, configTemplate, "utf-8");
      console.log(pc.green("✅ Created envsync.config.ts based on your environment"));
    }

    console.log(pc.blue("\nDone! Run `npx envsync build` to generate your typed environment files."));
  });

program
  .command("build")
  .description("Validate environment and generate typed code")
  .action(() => {
    const configPath = path.resolve(process.cwd(), "envsync.config.ts");
    if (!fs.existsSync(configPath)) {
      console.error(pc.red("❌ envsync.config.ts not found. Run `npx envsync init` first."));
      process.exit(1);
    }

    let config: SchemaConfig;
    try {
      config = loadConfig(configPath) as SchemaConfig;
    } catch (e: any) {
      console.error(pc.red("❌ Failed to load envsync.config.ts"));
      console.error(e.message);
      process.exit(1);
    }

    const { server, client, success } = validateSchema(config);
    
    // Print metadata warnings (expiration, etc.)
    printWarnings(server.warnings, client.warnings);

    if (!success) {
      printErrors(server.errors, client.errors);
      process.exit(1);
    }

    const outDir = path.resolve(process.cwd(), "src/config");
    generateServerEnv(config, outDir, configPath);
    generateClientEnv(config, outDir, configPath);

    console.log(pc.green("✅ Environment validated successfully!"));
    console.log(pc.blue(`Generated typed files in ${outDir}`));
  });

program
  .command("watch")
  .description("Watch environment and schema files for changes and regenerate automatically")
  .action(async () => {
    // We must import it dynamically or ensure it doesn't fail if dependencies are missing, but watch is part of the CLI.
    const { EnvSyncWatcher } = await import("./watch");
    const watcher = new EnvSyncWatcher();
    await watcher.start();
  });

function inferType(value: string): string {
  if (value.toLowerCase() === "true" || value.toLowerCase() === "false") return "boolean";
  if (!isNaN(Number(value)) && value.trim() !== "") return "number";
  if (value.startsWith("http://") || value.startsWith("https://")) return "url";
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null) return "json";
  } catch {}
  return "string";
}

program
  .command("diff <sourceA> <sourceB>")
  .description("Compare two environment sources (e.g. .env.production .env.staging) and report structural drift")
  .action((sourceA, sourceB) => {
    console.log(pc.blue(`Comparing ${sourceA} vs ${sourceB}...\n`));

    let envA: Record<string, string>;
    let envB: Record<string, string>;

    try {
      envA = loadSources([{ type: "external", path: sourceA }]);
    } catch (e: any) {
      console.error(pc.red(`❌ Failed to load ${sourceA}: ${e.message}`));
      process.exit(1);
    }

    try {
      envB = loadSources([{ type: "external", path: sourceB }]);
    } catch (e: any) {
      console.error(pc.red(`❌ Failed to load ${sourceB}: ${e.message}`));
      process.exit(1);
    }

    const keysA = new Set(Object.keys(envA));
    const keysB = new Set(Object.keys(envB));
    
    const allKeys = Array.from(new Set([...keysA, ...keysB])).sort();

    let hasDrift = false;

    console.log(pc.bold("Environment Drift Report:\n"));

    for (const key of allKeys) {
      const inA = keysA.has(key);
      const inB = keysB.has(key);

      if (inA && !inB) {
        console.log(`${pc.yellow("Missing")} - ${pc.bold(key)} is present in ${sourceA} but missing in ${sourceB}`);
        hasDrift = true;
      } else if (!inA && inB) {
        console.log(`${pc.yellow("Missing")} - ${pc.bold(key)} is present in ${sourceB} but missing in ${sourceA}`);
        hasDrift = true;
      } else {
        // Present in both, check type drift
        const valA = envA[key];
        const valB = envB[key];
        const typeA = inferType(valA);
        const typeB = inferType(valB);

        if (typeA !== typeB) {
          console.log(`${pc.magenta("Type Mismatch")} - ${pc.bold(key)} is ${pc.cyan(typeA)} in ${sourceA} but ${pc.cyan(typeB)} in ${sourceB}`);
          hasDrift = true;
        }
      }
    }

    if (!hasDrift) {
      console.log(pc.green("✅ No structural drift detected. Environments are perfectly aligned."));
    } else {
      console.log(`\n${pc.yellow("⚠️ Drift detected.")}`);
      // Don't exit with error code, it's just a report
    }
  });

function getFilesRecursive(dir: string, excludeDirs: Set<string>): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  let list: string[];
  try {
    list = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (excludeDirs.has(file) || excludeDirs.has(filePath)) continue;
      results = results.concat(getFilesRecursive(filePath, excludeDirs));
    } else {
      const ext = path.extname(file);
      if ([".ts", ".tsx", ".js", ".jsx", ".svelte", ".vue", ".astro"].includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

program
  .command("clean [dir]")
  .description("Statically analyze codebase to find unused (dead) environment variables defined in schema")
  .action((dir) => {
    const configPath = path.resolve(process.cwd(), "envsync.config.ts");
    if (!fs.existsSync(configPath)) {
      console.error(pc.red("❌ envsync.config.ts not found. Run `npx envsync init` first."));
      process.exit(1);
    }

    let config: SchemaConfig;
    try {
      config = loadConfig(configPath) as SchemaConfig;
    } catch (e: any) {
      console.error(pc.red("❌ Failed to load envsync.config.ts"));
      console.error(e.message);
      process.exit(1);
    }

    const serverKeys = config.server ? Object.keys(config.server) : [];
    const clientKeys = config.client ? Object.keys(config.client) : [];
    const allKeys = [...serverKeys, ...clientKeys];

    if (allKeys.length === 0) {
      console.log(pc.green("No environment variables defined in schema."));
      return;
    }

    const defaultDir = fs.existsSync(path.resolve(process.cwd(), "src")) ? "src" : ".";
    const scanDirName = dir || defaultDir;
    const scanDir = path.resolve(process.cwd(), scanDirName);

    console.log(pc.blue(`Scanning for unused environment variables in ${scanDirName}...\n`));

    const exclude = new Set([
      "node_modules", "dist", ".git", ".next", ".svelte-kit", ".nuxt", "out", "build", "coverage",
      path.resolve(process.cwd(), "src/config"),
      path.resolve(process.cwd(), "envsync.config.ts")
    ]);

    const files = getFilesRecursive(scanDir, exclude);
    
    const keyState = new Map<string, "unused" | "commented" | "active">();
    for (const key of allKeys) {
      keyState.set(key, "unused");
    }

    function stripComments(content: string): string {
      return content
        .replace(/\/\/[^\n]*/g, " ")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/<!--[\s\S]*?-->/g, " ");
    }

    for (const file of files) {
      if (file === configPath || file.includes(path.join("src", "config"))) {
        continue;
      }
      try {
        const content = fs.readFileSync(file, "utf-8");
        const stripped = stripComments(content);
        
        for (const key of allKeys) {
          const currentState = keyState.get(key);
          if (currentState === "active") continue;

          const regex = new RegExp(`\\b${key}\\b`);
          if (regex.test(stripped)) {
            keyState.set(key, "active");
          } else if (regex.test(content)) {
            keyState.set(key, "commented");
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    const unusedOrCommentedKeys: { key: string; state: "unused" | "commented" }[] = [];
    for (const [key, state] of keyState.entries()) {
      if (state !== "active") {
        unusedOrCommentedKeys.push({ key, state });
      }
    }

    if (unusedOrCommentedKeys.length === 0) {
      console.log(pc.green("✅ All defined environment variables are referenced in your codebase."));
    } else {
      console.log(pc.yellow(`⚠️ Found ${unusedOrCommentedKeys.length} unused environment variable(s):`));
      for (const { key, state } of unusedOrCommentedKeys) {
        const isClient = clientKeys.includes(key);
        const label = state === "commented" ? " (commented out)" : "";
        console.log(pc.yellow(`  - ${pc.bold(key)} (${isClient ? "client" : "server"})${pc.bold(label)}`));
      }
      console.log(pc.gray("\nThese variables are defined in your envsync.config.ts but were not found active in any source files."));
    }
  });

program.parse(process.argv);
