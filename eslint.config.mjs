import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // The portal restores persisted client state after hydration. These
    // guarded effects are covered by the component tests and are intentional.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "dist/**"]),
]);
