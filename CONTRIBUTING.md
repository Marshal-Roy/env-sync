# Contributing to EnvSync

First off, thank you for considering contributing to EnvSync! We aim to build the most robust, developer-friendly environment management tool in the JavaScript ecosystem, and community contributions are essential to making that happen.

## 🛠️ Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Marshal-Roy/env-sync.git
   cd env-sync
   ```

2. **Install dependencies:**
   We use `npm` as our package manager.
   ```bash
   npm install
   ```

3. **Run the test suite:**
   We use `vitest` for our testing framework.
   ```bash
   npm run test
   ```

4. **Build the package:**
   We use `tsup` to bundle the package.
   ```bash
   npm run build
   ```

## 🧪 Testing Guidelines

- Every new feature or bugfix should include corresponding tests.
- We have unit tests (in `test/engine.test.ts`), CLI integration tests (`test/cli.test.ts`), and code-gen snapshot tests (`test/generator.test.ts`).
- If you add a new validation type (e.g., `uuid`), make sure to add it to the schema, the engine validation logic, and write a test case to prove it correctly fails on bad input and coerces good input.

## 🚀 Submitting a Pull Request

1. Fork the repository and create your branch from `main`.
2. Ensure your code follows the existing style (we use Prettier and ESLint).
3. Ensure all tests pass.
4. If you've added a new feature, document it in `README.md`.
5. Issue a Pull Request with a clear title and description explaining *why* the change is needed and *how* it was implemented.

## 🐛 Reporting Bugs

If you find a bug, please create an issue with:
- A clear, descriptive title.
- Steps to reproduce the issue.
- Your framework (Next.js, Vite, etc.) and Node.js version.
- The relevant parts of your `envsync.config.ts` and `.env` files.

Happy coding!
