import fs from "fs";
import path from "path";
import { loadSources } from "../src/loaders";
import { SourceDef } from "../src/types";

const scratchDir = __dirname;
const projectRoot = path.resolve(__dirname, "..");

console.log("=== Testing loaders.ts scenarios ===\n");

function runTest(name: string, setup: () => SourceDef[], verify: (env: Record<string, string>, err: Error | null) => void) {
  let err: Error | null = null;
  let env: Record<string, string> = {};
  try {
    const sources = setup();
    env = loadSources(sources);
  } catch (e: any) {
    err = e;
  }
  
  try {
    verify(env, err);
    console.log(`✅ PASS: ${name}`);
  } catch (e: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${e.message}`);
    if (err) console.error(`   Caught error: ${err.message}`);
  }
}

// 1. Normal .env loading
runTest("Normal .env loading", () => {
  const envPath = path.join(scratchDir, ".env");
  fs.writeFileSync(envPath, "TEST_VAR=hello_world\n");
  return [{ type: "dotenv", path: envPath }];
}, (env, err) => {
  if (err) throw err;
  if (env.TEST_VAR !== "hello_world") throw new Error("TEST_VAR not loaded correctly");
});

// 2. Missing .env
runTest("Missing .env (should ignore)", () => {
  return [{ type: "dotenv", path: path.join(scratchDir, ".missing_env") }];
}, (env, err) => {
  if (err) throw err;
  if (Object.keys(env).length !== 0) throw new Error("Env should be empty");
});

// 3. External dotenv format file
runTest("External dotenv format file", () => {
  const extPath = path.join(scratchDir, "external.env");
  fs.writeFileSync(extPath, "EXT_VAR=from_ext\n");
  return [{ type: "external", path: extPath }];
}, (env, err) => {
  if (err) throw err;
  if (env.EXT_VAR !== "from_ext") throw new Error("EXT_VAR not loaded correctly");
});

// 4. External json format file
runTest("External json format file", () => {
  const extPath = path.join(scratchDir, "external.json");
  fs.writeFileSync(extPath, JSON.stringify({ JSON_VAR: "from_json", NUM_VAR: 123 }));
  return [{ type: "external", path: extPath }];
}, (env, err) => {
  if (err) throw err;
  if (env.JSON_VAR !== "from_json") throw new Error("JSON_VAR not loaded correctly");
  if (env.NUM_VAR !== "123") throw new Error("NUM_VAR not converted to string correctly");
});

// 5. External file path traversal attack
runTest("Path traversal attempt (outside project root)", () => {
  // Try to load a file in the parent directory of the project
  const traversalPath = path.join(projectRoot, "..", "some_file.env");
  return [{ type: "external", path: traversalPath }];
}, (env, err) => {
  if (!err) throw new Error("Should have thrown path traversal error");
  if (!err.message.includes("escapes the project root")) throw new Error(`Unexpected error: ${err.message}`);
});

// 6. External file too large
runTest("External file too large", () => {
  const extPath = path.join(scratchDir, "large.env");
  // Create a > 5MB file (sparse file using truncate if possible, but let's just write a 5.1MB buffer)
  const buf = Buffer.alloc(5 * 1024 * 1024 + 1024, "a=b\n");
  fs.writeFileSync(extPath, buf);
  return [{ type: "external", path: extPath }];
}, (env, err) => {
  // Clean up
  fs.unlinkSync(path.join(scratchDir, "large.env"));
  if (!err) throw new Error("Should have thrown too large error");
  if (!err.message.includes("too large")) throw new Error(`Unexpected error: ${err.message}`);
});

// 7. Invalid JSON format
runTest("Invalid JSON format", () => {
  const extPath = path.join(scratchDir, "invalid.json");
  fs.writeFileSync(extPath, "{ invalid json }");
  return [{ type: "external", path: extPath }];
}, (env, err) => {
  if (!err) throw new Error("Should have thrown parsing error");
  if (!err.message.includes("Failed to parse external JSON source")) throw new Error(`Unexpected error: ${err.message}`);
});

// 8. Prototype pollution via JSON
runTest("Prototype pollution prevention via JSON", () => {
  const extPath = path.join(scratchDir, "pollution.json");
  fs.writeFileSync(extPath, JSON.stringify({
    "__proto__": "polluted",
    "constructor": "polluted",
    "prototype": "polluted",
    "SAFE_VAR": "safe"
  }));
  return [{ type: "external", path: extPath }];
}, (env, err) => {
  if (err) throw err;
  if (env.SAFE_VAR !== "safe") throw new Error("SAFE_VAR not loaded");
  if (env["__proto__"] !== undefined || Object.getPrototypeOf(env) !== null) throw new Error("Prototype pollution occurred!");
  if (env["constructor"] !== undefined) throw new Error("Constructor polluted");
  if (env["prototype"] !== undefined) throw new Error("Prototype property polluted");
});

console.log("\nCleaning up scratch files...");
[".env", "external.env", "external.json", "invalid.json", "pollution.json"].forEach(f => {
  try { fs.unlinkSync(path.join(scratchDir, f)); } catch (e) {}
});
console.log("Done.");
