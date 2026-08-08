import { ValidationContext, ValidationError, Framework } from "./types";

const PREFIX_MAP: Record<Exclude<Framework, "none">, string> = {
  nextjs: "NEXT_PUBLIC_",
  vite: "VITE_",
  cra: "REACT_APP_",
  sveltekit: "PUBLIC_",
  nuxt: "NUXT_PUBLIC_",
};

export function validateField(ctx: ValidationContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const { key, value, def, isClient, framework, autoPrefix } = ctx;

  // Prefix validation
  if (isClient && framework && framework !== "none" && !autoPrefix) {
    const requiredPrefix = PREFIX_MAP[framework as keyof typeof PREFIX_MAP];
    if (requiredPrefix && !key.startsWith(requiredPrefix)) {
      errors.push({
        key,
        message: `Client variable "${key}" is missing the required "${requiredPrefix}" prefix for ${framework} projects. Rename it to "${requiredPrefix}${key}" or move it to the server block.`
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
      if (typeof value === "string") {
        errors.push({ key, message: `${key} must be a valid JSON string` });
      }
      break;
    case "enum":
      if (def.type === "enum" && !def.values.includes(value as string)) {
        errors.push({ key, message: `${key} must be one of: ${def.values.join(", ")}` });
      }
      break;
    case "url":
      try {
        new URL(value as string);
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
