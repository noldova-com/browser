/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ConsoleEvent } from "../../src/models/console-event.ts";
import { ConsoleRing } from "../../src/models/console-ring.ts";

class TextEvent extends ConsoleEvent {
  public readonly texts: string[] = [];
  private readonly text: string;

  public constructor(text: string) {
    super();
    this.text = text;
  }

  public addTo(_ring: ConsoleRing): void {
    this.texts.push(ConsoleEvent.cut(this.text));
  }
}

describe("ConsoleEvent", () => {
  it("keeps a text within the entry's limit whole, and cuts a longer one to the limit with a mark", () => {
    const short: TextEvent = new TextEvent("Cart loaded");
    const long: TextEvent = new TextEvent("x".repeat(3_000));

    short.addTo(new ConsoleRing("https://shop.test"));
    long.addTo(new ConsoleRing("https://shop.test"));

    expect([short.texts[0], (long.texts[0]?.length ?? 0) < 3_000, long.texts[0]?.endsWith(" [cut]")]).toEqual(["Cart loaded", true, true]);
  });
});
