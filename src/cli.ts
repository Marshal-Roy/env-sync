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
  .description("Scaffold envsync configuration in your project")
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

    const configPath = path.resolve(process.cwd(), "envsync.config.ts");
    if (fs.existsSync(configPath)) {
      console.log(pc.yellow("⚠️ envsync.config.ts already exists. Skipping config creation."));
    } else {
      let clientPrefix = "";
      if (framework === "nextjs") clientPrefix = "NEXT_PUBLIC_";
      if (framework === "vite") clientPrefix = "VITE_";
      if (framework === "cra") clientPrefix = "REACT_APP_";
      if (framework === "sveltekit") clientPrefix = "PUBLIC_";
      if (framework === "nuxt") clientPrefix = "NUXT_PUBLIC_";

      const configTemplate = `import { SchemaConfig } from "envsync";

export default {
  framework: "${framework}",
  autoPrefix: false,
  server: {
    DATABASE_URL: {
      type: "string",
      required: true,
    },
    PORT: {
      type: "number",
      default: 3000,
    },
  },
  client: {
    ${clientPrefix}API_URL: {
      type: "url",
      required: true,
    },
  },
} satisfies SchemaConfig;
`;
      fs.writeFileSync(configPath, configTemplate, "utf-8");
      console.log(pc.green("✅ Created envsync.config.ts"));
    }

    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      console.log(pc.yellow("⚠️ .env already exists. Skipping .env creation."));
    } else {
      let clientPrefix = "";
      if (framework === "nextjs") clientPrefix = "NEXT_PUBLIC_";
      if (framework === "vite") clientPrefix = "VITE_";
      if (framework === "cra") clientPrefix = "REACT_APP_";
      if (framework === "sveltekit") clientPrefix = "PUBLIC_";
      if (framework === "nuxt") clientPrefix = "NUXT_PUBLIC_";

      const envTemplate = `DATABASE_URL=postgres://localhost:5432/mydb
PORT=3000
${clientPrefix}API_URL=https://api.example.com
`;
      fs.writeFileSync(envPath, envTemplate, "utf-8");
      console.log(pc.green("✅ Created .env"));
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

program.parse(process.argv);
