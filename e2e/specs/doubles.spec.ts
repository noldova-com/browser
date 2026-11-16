/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import type { JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { TestApp } from "../fixtures/test-app.ts";

const FIRST_TRY = { intervals: [20], message: "The double never took the request." };

async function askAsSoonAsTakenAsync(app: TestApp, method: string, payload: JsonValue): Promise<void> {
  await expect.poll(() => app.requestAsync(method, payload).then(() => true, () => false), FIRST_TRY).toBe(true);
}

test.describe("the test app's doubles", () => {
  test.use({ waitsForStart: false });

  test("a page the agent double opens before its window part activates still opens", async ({ app }) => {
    await askAsSoonAsTakenAsync(app, "agent-double.openPage", { profileKey: "e2e", instance: randomUUID() });

    await expect(app.window.locator("nol-browser-page"), "The page opened before the window part activated never reached the window.").toHaveCount(1);
  });

  test("the relay double's page, opened before its window part activates, still opens", async ({ app }) => {
    await askAsSoonAsTakenAsync(app, "relay-double.open", null);

    await expect(app.window.locator("nol-relay-double-page"), "The relay page opened before the window part activated never reached the window.").toHaveCount(1);
  });
});
