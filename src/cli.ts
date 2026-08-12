#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import fs from "fs";
import path from "path";
import { generateServerEnv, generateClientEnv } from "./generator";
import { validateSchema, printErrors } from "./engine";
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

program.parse(process.argv);
