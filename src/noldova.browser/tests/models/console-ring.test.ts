/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ConsoleLevel } from "../../src/enums/console-level.ts";
import { ConsoleEntry } from "../../src/models/console-entry.ts";
import { ConsoleRead } from "../../src/models/console-read.ts";
import { ConsoleRing } from "../../src/models/console-ring.ts";

describe("ConsoleRing", () => {
  it("numbers its entries from 0, marks each with the origin it has then, and reads from a cursor on", () => {
    const ring: ConsoleRing = new ConsoleRing("https://shop.test");
    ring.add(ConsoleLevel.Info, "console", "first", 1);
    ring.navigate("https://pay.test");
    ring.add(null, "navigated to", "https://pay.test/", 2);

    expect(ring.read(1)).toStrictEqual(new ConsoleRead([new ConsoleEntry(1, null, "navigated to", "https://pay.test/", 2, "https://pay.test")], 0, 2, false));
    expect(new ConsoleRing("https://shop.test").read(0)).toStrictEqual(new ConsoleRead([], 0, 0, false));
  });

  it("drops its oldest entries past 500 entries or 262144 bytes, each entry counting its text, its source and 64 bytes", () => {
    const counted: ConsoleRing = new ConsoleRing("https://shop.test");
    for (let index: number = 0; index < 501; index++)
      counted.add(ConsoleLevel.Info, "console", `${index}`, 0);
    const sized: ConsoleRing = new ConsoleRing("https://shop.test");
    for (let index: number = 0; index < 125; index++)
      sized.add(ConsoleLevel.Info, "console", "x".repeat(2041), 0);

    expect([counted.read(0).oldest, counted.read(0).entries.length, sized.read(0).oldest, sized.read(0).entries.length]).toEqual([1, 500, 1, 124]);
  });

  it("says a read may repeat entries when it reaches a resume, after the ring dropped the entries around the resumes before it", () => {
    const ring: ConsoleRing = new ConsoleRing("https://shop.test");
    for (let resume: number = 0; resume < 3; resume++) {
      for (let index: number = 0; index < 100; index++)
        ring.add(ConsoleLevel.Info, "console", "entry", 0);
      ring.resume("https://shop.test");
    }
    for (let index: number = 0; index < 600; index++)
      ring.add(ConsoleLevel.Info, "console", "entry", 0);

    expect([ring.read(0).oldest, ring.read(0).mayRepeat, ring.read(300).mayRepeat, ring.read(301).mayRepeat, ring.read(900).mayRepeat]).toEqual([400, true, true, false, false]);
  });
});
