/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { defineConfig } from "playwright/test";

import { HangLimits } from "./fixtures/hang-limits.ts";
import { TestAppLayout } from "./fixtures/test-app-layout.ts";

// The tests that need the operating system's foreground focus, which no platform isolates per process, so they run last, one at a time,
// as the README's Checks section lists them: their project comes after the other tests', and the run's one worker runs the projects in
// turn. It doesn't depend on the other project, so a failure there still runs them.
const FOREGROUND_FOCUS = /(?:^|[/\\])(?:focus|keys|agent-input-focus)\.spec\.ts$/;

export default defineConfig({
  testDir: path.join(import.meta.dirname, "specs"),
  testMatch: "*.spec.ts",
  timeout: HangLimits.CI_TEST_COVERS_A_COLD_APP_START_AND_QUIT_MS,
  expect: { timeout: HangLimits.CI_TEST_COVERS_A_COLD_APP_START_AND_QUIT_MS },
  workers: 1,
  retries: 0,
  fullyParallel: false,
  forbidOnly: true,
  // A failed test keeps the trace of its steps and Playwright calls, so a hang names where it waited; a passed test's trace is dropped.
  use: { trace: "retain-on-failure" },
  outputDir: path.join(TestAppLayout.REPORT_FOLDER, "results"),
  reporter: [["list", { printFailuresInline: true }], ["json", { outputFile: path.join(TestAppLayout.REPORT_FOLDER, "report.json") }]],
  projects: [
    { name: "others", testIgnore: FOREGROUND_FOCUS },
    { name: "foreground focus", testMatch: FOREGROUND_FOCUS }
  ]
});
