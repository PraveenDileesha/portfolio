import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs, so no FlatCompat and no
// @eslint/eslintrc dependency is needed here.
const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "out/**"] },
  ...coreWebVitals,
  ...nextTypescript,
];

export default config;
