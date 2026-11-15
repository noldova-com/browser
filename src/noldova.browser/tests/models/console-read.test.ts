/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ConsoleEntry } from "../../src/models/console-entry.ts";
import { ConsoleRead } from "../../src/models/console-read.ts";

describe("ConsoleRead", () => {
  it("keeps its fields", () => {
    const entry: ConsoleEntry = new ConsoleEntry(3, "Info", "console", "Ready", 1_700_000_000_000, "https://shop.test");
    const read: ConsoleRead = new ConsoleRead([entry], 2, 4, true);

    expect([read.entries, read.oldest, read.next, read.mayRepeat]).toEqual([[entry], 2, 4, true]);
  });
});
