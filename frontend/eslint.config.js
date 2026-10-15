const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/dist/**",
      "**/web-build/**",
      "**/assets/**",
      "**/ios/**",
      "**/android/**",
      "**/expo-env.d.ts",
      "**/*.tsbuildinfo",
      "**/public/**",
    ],
  },
  expoConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/exhaustive-deps": "off",
      "no-unused-vars": "off",
    },
  },
]);
