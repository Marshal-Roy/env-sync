import { FieldDef } from "./types";

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
