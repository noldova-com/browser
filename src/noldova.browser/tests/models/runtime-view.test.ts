/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ExecutionContext } from "../../src/models/execution-context.ts";
import { RuntimeView } from "../../src/models/runtime-view.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

class HeardEvents {
  public track: (method: string, params: JsonObject) => void = () => undefined;
  public stops: number = 0;

  public listen(track: (method: string, params: JsonObject) => void): () => void {
    this.track = track;
    return () => {
      this.stops += 1;
    };
  }
}

describe("RuntimeView", () => {
  const CONTEXT: JsonObject = { context: { id: 3, uniqueId: "u-3", name: "noldova-browser-changes", auxData: { frameId: "F1" } } };

  it("keeps each context the view reports until the view destroys or clears it", () => {
    const heard: HeardEvents = new HeardEvents();
    const view: RuntimeView = new RuntimeView(t => heard.listen(t));

    heard.track("Runtime.executionContextCreated", CONTEXT);
    heard.track("Runtime.executionContextCreated", { context: { id: 4, uniqueId: "u-4", name: "", auxData: { frameId: "F2" } } });
    const created: unknown[] = [view.contextOf(3), view.contextOf(4)];
    heard.track("Runtime.executionContextDestroyed", { executionContextId: 3 });
    const destroyed: unknown[] = [view.contextOf(3), view.contextOf(4)];
    heard.track("Runtime.executionContextsCleared", {});

    expect([created, destroyed, view.contextOf(4)]).toStrictEqual([[new ExecutionContext(3, "u-3", "noldova-browser-changes", "F1"),
      new ExecutionContext(4, "u-4", "", "F2")], [undefined, new ExecutionContext(4, "u-4", "", "F2")], undefined]);
  });

  it("ignores a context of the wrong shape, and a destroyed id that isn't a number", () => {
    const heard: HeardEvents = new HeardEvents();
    const view: RuntimeView = new RuntimeView(t => heard.listen(t));
    heard.track("Runtime.executionContextCreated", CONTEXT);

    for (const context of [null, { id: "5", uniqueId: "u-5", name: "", auxData: { frameId: "F1" } }, { id: 5, uniqueId: 5, name: "", auxData: { frameId: "F1" } },
      { id: 5, uniqueId: "u-5", name: 5, auxData: { frameId: "F1" } }, { id: 5, uniqueId: "u-5", name: "", auxData: null }, { id: 5, uniqueId: "u-5", name: "", auxData: { frameId: 1 } }])
      heard.track("Runtime.executionContextCreated", { context });
    heard.track("Runtime.executionContextDestroyed", { executionContextId: "3" });

    expect([view.contextOf(3)?.uniqueId, view.contextOf(5)]).toEqual(["u-3", undefined]);
  });

  it("wakes each wait on every event it hears and when told to, until the wait is removed, and stops hearing when stopped", () => {
    const heard: HeardEvents = new HeardEvents();
    const view: RuntimeView = new RuntimeView(t => heard.listen(t));
    let wakes: number = 0;
    const wait = (): void => {
      wakes += 1;
    };
    view.addWait(wait);

    heard.track("Page.loadEventFired", {});
    view.wake();
    view.removeWait(wait);
    view.wake();
    view.stop();

    expect([wakes, heard.stops]).toEqual([2, 1]);
  });
});
