/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsoleEntry } from "../../src/models/console-entry.ts";
import { ConsoleEvent } from "../../src/models/console-event.ts";
import { ConsoleNavigationEvent } from "../../src/models/console-navigation-event.ts";
import { ConsoleRing } from "../../src/models/console-ring.ts";

describe("ConsoleNavigationEvent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps its fields, as a console event", () => {
    const event: ConsoleNavigationEvent = new ConsoleNavigationEvent("https://shop.test/cart", "https://shop.test");

    expect(event).toBeInstanceOf(ConsoleEvent);
    expect([event.url, event.origin]).toEqual(["https://shop.test/cart", "https://shop.test"]);
  });

  it("moves the ring to its origin and adds the navigation as an entry of that origin, at the time it is heard", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_700_000_000_000);
    const ring: ConsoleRing = new ConsoleRing("https://shop.test");

    new ConsoleNavigationEvent("https://docs.example/", "https://docs.example").addTo(ring);

    const entry: ConsoleEntry | undefined = ring.read(0).entries[0];
    expect([entry?.level, entry?.source, entry?.text, entry?.time, entry?.origin]).toEqual([null, "navigated to", "https://docs.example/", 1_700_000_000_000,
      "https://docs.example"]);
  });
});
