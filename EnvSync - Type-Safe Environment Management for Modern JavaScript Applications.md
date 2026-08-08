# EnvSync - Type-Safe Environment Management for Modern JavaScript Applications

Build a production-ready NPM package called **EnvSync** that eliminates direct usage of `process.env` and provides a fully typed, validated, framework-agnostic environment management system for Node.js, Next.js, Vite, Payload CMS, Express, NestJS, and other JavaScript/TypeScript applications.

## Core Problem

Developers frequently face the following issues when working with environment variables:

- `process.env` values are always typed as `string | undefined`
- Missing environment variables are discovered only at runtime
- No automatic validation of types (number, boolean, array, etc.)
- Sensitive server-side variables can accidentally be exposed to client bundles
- No centralized source of truth for environment variables
- Poor autocomplete and developer experience
- Different projects implement environment validation differently
- Managing environment variables from multiple sources (.env, external files, Docker secrets, cloud secrets) is inconsistent

## Package Goal

Create a single solution that generates strongly typed environment objects from a schema definition and provides:

- Type safety
- Validation
- Autocomplete
- Client/server separation
- Environment source abstraction
- Automatic code generation
- Development watch mode
- Framework integrations

The package should make developers stop using:

```ts
process.env.DATABASE_URL
process.env.PORT
process.env.JWT_SECRET
```

and instead use:

```ts
import { env } from "@/config/env"

env.DATABASE_URL
env.PORT
env.JWT_SECRET
```

with full TypeScript support.

---

# Initialization Flow

The package should expose a CLI:

```bash
npx envsync init
```

This command generates:

```txt
project/
├── envsync.config.ts
├── .env
└── src/
    └── config/
        └── env.ts
```

Example generated configuration:

```ts
export default {
  server: {
    DATABASE_URL: {
      type: "string",
      required: true
    },

    PAYLOAD_SECRET: {
      type: "string",
      required: true
    },

    SMTP_PORT: {
      type: "number",
      default: 587
    },

    ENABLE_CACHE: {
      type: "boolean",
      default: false
    }
  },

  client: {
    NEXT_PUBLIC_API_URL: {
      type: "string",
      required: true
    },

    NEXT_PUBLIC_APP_NAME: {
      type: "string",
      default: "My App"
    }
  }
}
```

This configuration becomes the single source of truth.

---

# Build Command

Provide:

```bash
npx envsync build
```

The build process should:

1. Read the schema configuration
2. Load environment variables from configured sources
3. Validate all values
4. Generate TypeScript types
5. Generate runtime-safe environment objects

If validation fails:

```txt
❌ Missing DATABASE_URL
❌ SMTP_PORT must be a number
❌ ENABLE_CACHE must be a boolean
```

The build must fail immediately.

---

# Generated Output

Generate:

```ts
export interface ServerEnv {
  DATABASE_URL: string
  PAYLOAD_SECRET: string
  SMTP_PORT: number
  ENABLE_CACHE: boolean
}

export interface ClientEnv {
  NEXT_PUBLIC_API_URL: string
  NEXT_PUBLIC_APP_NAME: string
}

export const serverEnv: ServerEnv
export const clientEnv: ClientEnv
```

Usage:

```ts
import { serverEnv } from "@/config/server-env"

serverEnv.DATABASE_URL
serverEnv.SMTP_PORT
```

```ts
import { clientEnv } from "@/config/client-env"

clientEnv.NEXT_PUBLIC_API_URL
```

No direct access to `process.env` should be required in application code.

---

# Client / Server Security

This is a primary feature.

Server variables must never be available in client bundles.

If a developer imports:

```ts
import { serverEnv } from "@/config/server-env"
```

inside a client-side file:

```txt
❌ Cannot import serverEnv into client bundle.
```

Build should fail with a clear error.

The package should automatically separate generated files:

```txt
src/config/
├── server-env.ts
└── client-env.ts
```

to enforce boundaries.

---

# Supported Types

Support:

```ts
string
number
boolean
array
json
enum
url
email
```

Examples:

```ts
SMTP_PORT: {
  type: "number"
}

ALLOWED_ORIGINS: {
  type: "array"
}

LOG_LEVEL: {
  type: "enum",
  values: ["debug", "info", "warn", "error"]
}
```

---

# Environment Sources

Support multiple sources:

### Standard .env

```ts
source: {
  type: "dotenv",
  path: ".env"
}
```

### External File

```ts
source: {
  type: "external",
  path: "/etc/secrets/app.env"
}
```

### Process Environment

```ts
source: {
  type: "process"
}
```

### Multiple Sources

```ts
sources: [
  {
    type: "dotenv",
    path: ".env"
  },
  {
    type: "external",
    path: "/etc/secrets/app.env"
  }
]
```

Merge sources with configurable priority.

---

# Watch Mode

Provide:

```bash
npx envsync watch
```

Features:

- Watch schema changes
- Watch environment source changes
- Regenerate generated files automatically
- Trigger HMR when possible
- Fast incremental rebuilds

---

# Framework Integrations

Provide official integrations for:

### Next.js

```ts
import { nextPlugin } from "envsync/next"
```

### Vite

```ts
import { vitePlugin } from "envsync/vite"
```

### Payload CMS

```ts
import { payloadPlugin } from "envsync/payload"
```

### Express

```ts
import { loadEnv } from "envsync"
```

### NestJS

```ts
import { EnvSyncModule } from "envsync/nest"
```

Plugins should automatically run validation and code generation during development and build.

---

# Developer Experience Goals

The package should provide:

- Full TypeScript autocomplete
- Compile-time type safety
- Runtime validation
- Clear error messages
- Zero direct `process.env` usage
- Automatic code generation
- Framework-agnostic architecture
- Production-ready security boundaries
- Multiple environment source support
- Excellent onboarding experience

The primary value proposition is:

**"Stop using process.env directly. Get a fully typed, validated, secure environment system with automatic code generation and client/server protection."**