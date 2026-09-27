// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*", "api/*"] },
  // Apostrophes in <Text> are fine in React Native; this rule targets HTML.
  { rules: { "react/no-unescaped-entities": "off" } },
]);
