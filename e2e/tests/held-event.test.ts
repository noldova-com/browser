/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { EventChannel } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { HeldEvent } from "../app/src/modules/agent-double/runtime/src/held-event.ts";

describe("HeldEvent", () => {
  function hold(): { event: HeldEvent; delivered: JsonValue[] } {
    const delivered: JsonValue[] = [];
    return { event: new HeldEvent(new EventChannel(payload => delivered.push(payload), () => undefined)), delivered };
  }

  it("delivers nothing before its listener says it listens", () => {
    const { event, delivered } = hold();

    event.publish({ url: "first" });

    expect(delivered).toEqual([]);
  });

  it("delivers a held opening once when its listener says it listens", () => {
    const { event, delivered } = hold();
    event.publish({ url: "first" });

    event.listen();

    expect(delivered).toEqual([{ url: "first" }]);
  });

  it("delivers two held openings in the order they came", () => {
    const { event, delivered } = hold();
    event.publish({ url: "first" });
    event.publish({ url: "second" });

    event.listen();

    expect(delivered).toEqual([{ url: "first" }, { url: "second" }]);
  });

  it("delivers held openings only once when its listener says it listens twice, and then delivers at once", () => {
    const { event, delivered } = hold();
    event.publish({ url: "first" });

    event.listen();
    event.listen();
    event.publish({ url: "second" });

    expect(delivered).toEqual([{ url: "first" }, { url: "second" }]);
  });
});
