export type FieldType = "string" | "number" | "boolean" | "array" | "json" | "enum" | "url" | "email";

export type Framework = "nextjs" | "vite" | "cra" | "sveltekit" | "nuxt" | "none";

export interface EnumFieldDef {
  type: "enum";
  values: string[];
  required?: boolean;
  default?: string;
}

export interface BaseFieldDef {
  type: Exclude<FieldType, "enum">;
  required?: boolean;
  default?: any;
}

export type FieldDef = BaseFieldDef | EnumFieldDef;

export interface SourceDef {
  type: "dotenv" | "external" | "process";
  path?: string;
}

export interface SchemaConfig {
  framework?: Framework;
  autoPrefix?: boolean;
  sources?: SourceDef[];
  server?: Record<string, FieldDef>;
  client?: Record<string, FieldDef>;
}

export interface ValidationContext {
  key: string;
  value: any;
  def: FieldDef;
  isClient: boolean;
  framework?: Framework;
  autoPrefix?: boolean;
}

export interface ValidationError {
  key: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data: Record<string, any>;
}
