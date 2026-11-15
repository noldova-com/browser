/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ConsoleEntryEvent } from "../../src/models/console-entry-event.ts";
import { ConsoleEntry } from "../../src/models/console-entry.ts";
import { ConsoleEvent } from "../../src/models/console-event.ts";
import { ConsoleRing } from "../../src/models/console-ring.ts";

describe("ConsoleEntryEvent", () => {
  it("keeps its fields, as a console event", () => {
    const event: ConsoleEntryEvent = new ConsoleEntryEvent("Error", "exception", "Uncaught", 1_700_000_000_000);

    expect(event).toBeInstanceOf(ConsoleEvent);
    expect([event.level, event.source, event.text, event.time]).toEqual(["Error", "exception", "Uncaught", 1_700_000_000_000]);
  });

  it("adds itself to the ring as an entry of the ring's origin, cutting a text over the entry's limit", () => {
    const ring: ConsoleRing = new ConsoleRing("https://shop.test");

    new ConsoleEntryEvent("Error", "exception", "x".repeat(3_000), 1_700_000_000_000).addTo(ring);

    const entry: ConsoleEntry | undefined = ring.read(0).entries[0];
    expect([entry?.level, entry?.source, entry?.text.endsWith(" [cut]"), entry?.time, entry?.origin]).toEqual(["Error", "exception", true, 1_700_000_000_000,
      "https://shop.test"]);
  });
});
