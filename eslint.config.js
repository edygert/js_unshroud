import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  // Base JavaScript configuration
  js.configs.recommended,

  // TypeScript files configuration
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        globalThis: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs["recommended-requiring-type-checking"].rules,
      // Project-specific overrides
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "no-console": "off", // Allow console usage for logging
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // JavaScript files (instrumentation) configuration
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script", // Instrumentation scripts run in browser context
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        XMLHttpRequest: "readonly",
        WebSocket: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        navigator: "readonly",
        performance: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        addEventListener: "readonly",
        removeEventListener: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
      "no-var": "error",
      "no-console": "off",
      "strict": ["error", "function"], // Instrumentation scripts should be strict
    },
  },

  // Test files configuration
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        globalThis: "readonly",
        Buffer: "readonly",
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off", // Tests often need assertions
      "@typescript-eslint/no-floating-promises": "off", // Test expectations don't need to be awaited
      "@typescript-eslint/unbound-method": "off", // Mocked methods and framework globals
      "@typescript-eslint/no-explicit-any": "off", // Mock objects often need any
      "@typescript-eslint/no-unsafe-assignment": "off", // Mock assignments
      "@typescript-eslint/no-unsafe-call": "off", // Mock calls
      "@typescript-eslint/no-unsafe-member-access": "off", // Mock member access
      "@typescript-eslint/no-unsafe-argument": "off", // Mock arguments
      "@typescript-eslint/no-unsafe-return": "off", // Mock returns
    },
  },

  // Global ignore patterns
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
      "bun.lock",
    ],
  },
];
