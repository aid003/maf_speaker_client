import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import fsdPlugin from "eslint-plugin-fsd-lint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // FSD: без слоёв pages и processes (app = страницы в Next.js)
  {
    plugins: { fsd: fsdPlugin },
    rules: {
      "fsd/forbidden-imports": [
        "error",
        {
          alias: { value: "@", withSlash: true },
          folderPattern: { enabled: false },
        },
      ],
      "fsd/no-relative-imports": "error",
      "fsd/no-public-api-sidestep": "error",
      "fsd/no-cross-slice-dependency": "error",
      "fsd/no-ui-in-business-logic": "error",
      "fsd/no-global-store-imports": "error",
      "fsd/ordered-imports": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
