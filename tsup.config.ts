import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts", 
    "src/cli.ts", 
    "src/plugins/vite.ts", 
    "src/plugins/next.ts", 
    "src/plugins/payload.ts", 
    "src/plugins/nest.ts"
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["vite", "next", "payload", "@nestjs/common"],
});
