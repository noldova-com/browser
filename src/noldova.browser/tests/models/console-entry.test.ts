/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ConsoleEntry } from "../../src/models/console-entry.ts";

describe("ConsoleEntry", () => {
  it("keeps its fields", () => {
    const consoleEntry: ConsoleEntry = new ConsoleEntry(3, "Warning", "console", "Low stock", 1_700_000_000_000, "https://shop.test");

    expect([consoleEntry.sequence, consoleEntry.level, consoleEntry.source, consoleEntry.text, consoleEntry.time, consoleEntry.origin]).toEqual([3, "Warning", "console", "Low stock", 1_700_000_000_000, "https://shop.test"]);
  });
});
