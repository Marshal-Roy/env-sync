import { ValidationContext, ValidationError, ValidationWarning, FieldDef, Framework } from "./types";

/**
 * Keys matching this pattern in the `client` block will trigger a hard error
 * unless `sensitive: false` is explicitly set on the field definition.
 * This catches accidental exposure of secrets (e.g. DATABASE_URL, JWT_SECRET)
 * in client-side bundles where they'd be visible to anyone.
 */
const SENSITIVE_KEY_RE = /secret|token|key|password|private|credential|cert|auth/i;


const PREFIX_MAP: Record<Exclude<Framework, "none">, string> = {
  nextjs: "NEXT_PUBLIC_",
  vite: "VITE_",
  cra: "REACT_APP_",
  sveltekit: "PUBLIC_",
  nuxt: "NUXT_PUBLIC_",
};

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

export function validateField(ctx: ValidationContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { key, value, def, isClient, framework, autoPrefix } = ctx;

  // Client secret leakage guard
  const isSensitiveHeuristic = SENSITIVE_KEY_RE.test(key);
  const isExplicitlySensitive = def.sensitive === true;
  const isExplicitlySafe = def.sensitive === false;

  if (isClient && !isExplicitlySafe && (isExplicitlySensitive || isSensitiveHeuristic)) {
    errors.push({
      key,
      message: isExplicitlySensitive
        ? `Client variable "${key}" is explicitly marked as \`sensitive: true\`. It cannot be in the "client" block.`
        : `Client variable "${key}" looks like a sensitive secret (matches: secret|token|key|password|private|credential|cert|auth). ` +
          `Move it to the "server" block, or set \`sensitive: false\` on this field if it is intentionally public.`,
    });
  }

  // Prefix validation
  if (isClient && framework && framework !== "none" && !autoPrefix) {
    const requiredPrefix = PREFIX_MAP[framework as keyof typeof PREFIX_MAP];
    if (requiredPrefix && !key.startsWith(requiredPrefix)) {
      // Typo detection
      // Check if the key starts with a typo of the prefix
      const keyPrefix = key.split("_")[0] + "_"; // e.g. "NEXT_"
      const distance = levenshtein(keyPrefix, requiredPrefix);
      
      let suggestion = `Rename it to "${requiredPrefix}${key}"`;
      if (distance > 0 && distance <= 7 && requiredPrefix.startsWith(keyPrefix.replace("_", ""))) {
        // Close enough prefix typo
        suggestion = `Did you mean "${requiredPrefix}${key.slice(keyPrefix.length)}"?`;
      }

      errors.push({
        key,
        message: `Client variable "${key}" is missing the required "${requiredPrefix}" prefix for ${framework} projects. ${suggestion} or move it to the server block.`
      });
    }
  }

  // Required validation
  if (def.required && (value === undefined || value === null || value === "")) {
    errors.push({ key, message: `Missing required variable: ${key}` });
    return errors; // stop further validation if missing
  }

  // If not required and undefined, it's valid
  if (value === undefined || value === null || value === "") {
    return errors;
  }

  // Type validation
  switch (def.type) {
    case "string":
      if (typeof value !== "string") {
        errors.push({ key, message: `${key} must be a string` });
      }
      break;
    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        errors.push({ key, message: `${key} must be a number` });
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push({ key, message: `${key} must be a boolean` });
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        errors.push({ key, message: `${key} must be an array` });
      }
      break;
    case "json":
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
      ) {
        errors.push({ key, message: `${key} must be a valid JSON object (plain key-value object, not a string, array, or primitive)` });
      }
      break;
    case "enum":
      if (def.type === "enum" && !def.values.includes(value as string)) {
        errors.push({ key, message: `${key} must be one of: ${def.values.join(", ")}` });
      }
      break;
    case "url":
      try {
        const parsed = new URL(value as string);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          errors.push({ key, message: `${key} must be an http or https URL (got scheme: "${parsed.protocol}")` });
        }
      } catch {
        errors.push({ key, message: `${key} must be a valid URL` });
      }
      break;
    case "email":
      if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push({ key, message: `${key} must be a valid email address` });
      }
      break;
  }

  return errors;
}

export function validateMetadata(key: string, def: FieldDef): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  if (def.expiresAt) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(def.expiresAt)) {
      warnings.push({
        key,
        message: `Invalid expiresAt date format "${def.expiresAt}". Use YYYY-MM-DD.`,
      });
      return warnings;
    }

    const expiryDate = new Date(def.expiresAt + "T00:00:00");
    if (isNaN(expiryDate.getTime())) {
      warnings.push({
        key,
        message: `Invalid expiresAt date "${def.expiresAt}".`,
      });
      return warnings;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (expiryDate < today) {
      warnings.push({
        key,
        message: `Variable has expired (expiration date: ${def.expiresAt}).`,
      });
    } else {
      const msDiff = expiryDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      if (daysDiff <= 30) {
        warnings.push({
          key,
          message: `Variable will expire soon on ${def.expiresAt} (in ${daysDiff} day${daysDiff === 1 ? "" : "s"}).`,
        });
      }
    }
  }
  return warnings;
}
