# EnvSync 🚀

> Type-Safe Environment Management for Modern JavaScript Applications

EnvSync is a production-ready package that completely eliminates raw `process.env` usage. It replaces it with a fully typed, validated, and auto-generated environment management system that integrates seamlessly with your favorite frameworks.

[![NPM Version](https://img.shields.io/npm/v/envsync.svg)](https://www.npmjs.com/package/envsync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- **Type-Safe:** Full TypeScript autocomplete for your environment variables. Never guess what a variable is named again.
- **Validation Engine:** Automatically coerces types (numbers, booleans, arrays, JSON) and validates formats (URLs, emails, enums).
- **Security Boundaries:** Strictly separates `serverEnv` and `clientEnv` to ensure backend secrets never leak into client bundles.
- **Framework Auto-Detection:** Automatically detects Next.js, Vite, Nuxt, SvelteKit, and Create React App, enforcing their mandatory variable prefixes (`NEXT_PUBLIC_`, `VITE_`, etc.).
- **Live Watch Mode:** Edit your `.env` or schema file and your types are instantly regenerated.
- **Zero-Config Integrations:** First-class plugins for Vite, Next.js, NestJS, Payload CMS, and Express.

---

## 📦 Installation

```bash
npm install envsync
```

---

## 🚀 Quick Start

**1. Initialize EnvSync in your project:**

Run the init command at the root of your project:
```bash
npx envsync init
```
This will automatically detect your framework and generate two files:
- `envsync.config.ts` (Your single source of truth for all environment variables)
- `.env` (Prepopulated with scaffolded variables)

**2. Define your schema in `envsync.config.ts`:**

```typescript
import { SchemaConfig } from "envsync";

export default {
  framework: "nextjs", // Auto-detected!
  server: {
    DATABASE_URL: { type: "string", required: true },
    PORT: { type: "number", default: 3000 },
  },
  client: {
    NEXT_PUBLIC_API_URL: { type: "url", required: true },
  },
} satisfies SchemaConfig;
```

**3. Run the generator:**

```bash
npx envsync build
```
*(Or use `npx envsync watch` to run in live-reloading mode during development)*

This generates `src/config/server-env.ts` and `src/config/client-env.ts`.

**4. Use it in your app!**

*In a server component, API route, or backend service:*
```typescript
import { serverEnv } from "@/config/server-env";

// Fully typed! serverEnv.PORT is guaranteed to be a number.
console.log(`Connecting to ${serverEnv.DATABASE_URL} on port ${serverEnv.PORT}`);
```

*In a client component:*
```typescript
import { clientEnv } from "@/config/client-env";

fetch(`${clientEnv.NEXT_PUBLIC_API_URL}/users`);
```

*(Note: `serverEnv` has a built-in runtime guard that will immediately throw an error if you accidentally import it into client-side code).*

---

## 🔌 Framework Integrations

EnvSync comes with official plugins that automate the validation and watch cycles.

### Next.js
Wrap your `next.config.js`:
```javascript
const { envsyncNextPlugin } = require("envsync/next");

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = envsyncNextPlugin()(nextConfig);
```

### Vite
Add to your `vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import { envsyncVitePlugin } from "envsync/vite";

export default defineConfig({
  plugins: [envsyncVitePlugin()],
});
```

### NestJS
Import the global module in `app.module.ts`:
```typescript
import { Module } from "@nestjs/common";
import { EnvSyncModule } from "envsync/nest";

@Module({
  imports: [EnvSyncModule.forRoot()],
})
export class AppModule {}
```
You can then inject `"SERVER_ENV"` or `"CLIENT_ENV"` anywhere in your providers.

### Payload CMS
Wrap your Payload config:
```typescript
import { buildConfig } from "payload";
import { envsyncPayloadPlugin } from "envsync/payload";

export default buildConfig(
  envsyncPayloadPlugin()({
    // ... your payload config
  })
);
```

### Express / Plain Node
Trigger validation immediately upon server boot:
```typescript
import { loadEnv } from "envsync";

const { serverEnv } = loadEnv();
console.log("Server config loaded!", serverEnv);
```

---

## 🛠️ Configuration Schema Reference

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"string" \| "number" \| "boolean" \| "array" \| "json" \| "enum" \| "url" \| "email"` | The expected type of the variable. |
| `required` | `boolean` | If `true`, the build fails if the variable is missing. |
| `default` | `any` | Fallback value if the variable is missing. (Makes it optional). |
| `values` | `string[]` | Required if `type` is `"enum"`. Specifies allowed values. |

### Auto-Prefixing (Advanced)
If you set `autoPrefix: true` in your config, EnvSync allows you to define your schema without framework prefixes (e.g., just `API_URL`). 
- In your `.env` file, you still write `VITE_API_URL`. 
- In your code, you use `clientEnv.API_URL`.
- EnvSync handles the mapping statically in the generated code!

---

## 📄 License

MIT © [Himanshu Roy](https://github.com/Marshal-Roy)
