/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PaneQueue } from "../../src/models/pane-queue.ts";

interface IGate {
  readonly promise: Promise<void>;
  open(): void;
}

function gate(): IGate {
  let open: () => void = () => undefined;
  const promise: Promise<void> = new Promise<void>(resolve => {
    open = resolve;
  });
  return { promise, open: (): void => open() };
}

describe("PaneQueue", () => {
  it("runs one pane's calls one at a time, in order", async () => {
    const queue: PaneQueue = new PaneQueue();
    const order: string[] = [];
    const first: IGate = gate();
    const started: PromiseWithResolvers<void> = Promise.withResolvers<void>();

    const one: Promise<string> = queue.runAsync("view", async () => {
      order.push("one starts");
      started.resolve();
      await first.promise;
      order.push("one ends");
      return "one";
    });
    const two: Promise<string> = queue.runAsync("view", async () => {
      order.push("two starts");
      return "two";
    });
    await started.promise;
    expect(order).toEqual(["one starts"]);
    first.open();

    expect(await Promise.all([one, two])).toEqual(["one", "two"]);
    expect(order).toEqual(["one starts", "one ends", "two starts"]);
  });

  it("runs different panes' calls side by side", async () => {
    const queue: PaneQueue = new PaneQueue();
    const blocked: IGate = gate();

    const slow: Promise<string> = queue.runAsync("view", async () => {
      await blocked.promise;
      return "slow";
    });

    expect(await queue.runAsync("other", async () => "fast")).toBe("fast");
    blocked.open();
    expect(await slow).toBe("slow");
  });

  it("goes on after a failed call and passes its failure to its caller", async () => {
    const queue: PaneQueue = new PaneQueue();
    const failure: Error = new Error("failed");

    const failed: Promise<string> = queue.runAsync("view", async () => {
      throw failure;
    });
    const next: Promise<string> = queue.runAsync("view", async () => "next");

    await expect(failed).rejects.toBe(failure);
    expect(await next).toBe("next");
    expect(await queue.runAsync("view", async () => "after")).toBe("after");
  });
});
