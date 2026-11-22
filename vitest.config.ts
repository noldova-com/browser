/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "_build/vite",
  test: {
    isolate: true,
    // Only the module package takes context's checks, so only its tests load them, and a protocol test that needs them fails.
    projects: [
      {
        extends: true,
        test: {
          name: "module",
          include: ["src/noldova.browser/tests/**/*.test.ts"],
          setupFiles: ["src/noldova.browser/tests/context-core.setup.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "protocol, e2e fixtures and scripts",
          include: ["src/noldova.browser.protocol/tests/**/*.test.ts", "e2e/tests/**/*.test.ts", "scripts/tests/**/*.test.ts"]
        }
      }
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.ts"
      ],
      exclude: [
        "**/tests/**",
        "src/*.window/**"
      ],
      reporter: [
        ["text", { skipEmpty: true }],
        "json-summary"
      ],
      reportsDirectory: "_build/coverage",
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
