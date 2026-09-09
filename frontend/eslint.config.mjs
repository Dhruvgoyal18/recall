import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/dashboard/Dashboard.tsx"],
    rules: {
      // This component fetches on prop/state change ("reset then fetch" —
      // https://react.dev/learn/synchronizing-with-effects#fetching-data),
      // which the rule's static analysis can't distinguish from the
      // footgun it targets. Silenced deliberately for this file only.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
