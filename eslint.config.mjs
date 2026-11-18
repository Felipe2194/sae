import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Handoff de diseño (prototipos sueltos, fuera de git — ver .gitignore):
    // no es código de la app y hacía fallar `npm run lint` en local.
    "landing/**",
    "backups/**",
  ]),
]);

export default eslintConfig;
