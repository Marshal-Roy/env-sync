import { FieldDef } from "./types";

/**
 * Strict numeric regex: accepts only plain integers and decimals.
 * Explicitly rejects hex (0x...), scientific (1e10), Infinity, -Infinity, NaN,
 * and purely whitespace — all of which Number() would accept.
 */
const STRICT_NUMBER_RE = /^-?(\d+\.?\d*|\.\d+)$/;

export function coerceValue(value: string | undefined, def: FieldDef): any {
  if (value === undefined || value === "") {
    return def.default !== undefined ? def.default : undefined;
  }

  switch (def.type) {
    case "string":
    case "url":
    case "email":
    case "enum":
      return value;

    case "number": {
      if (!STRICT_NUMBER_RE.test(value)) {
        // Return the raw string — validation will reject it with a clear error
        return value;
      }
      const num = Number(value);
      return isNaN(num) ? value : num;
    }

    case "boolean": {
      const lower = value.toLowerCase();
      if (lower === "true" || lower === "1" || lower === "yes") return true;
      if (lower === "false" || lower === "0" || lower === "no") return false;
      return value; // if not parsable, return raw so validation can catch it
    }

    case "array": {
      try {
        // support ["a", "b"] json format or comma-separated a,b,c
        if (value.startsWith("[") && value.endsWith("]")) {
          return JSON.parse(value);
        }
        return value.split(",").map((v) => v.trim()).filter(Boolean);
      } catch (e) {
        return value;
      }
    }

    case "json": {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value; // raw string will fail json validation
      }
    }

    default:
      return value;
  }
}
