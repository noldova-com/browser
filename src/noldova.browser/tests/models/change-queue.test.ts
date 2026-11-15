/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChangeQueue } from "../../src/models/change-queue.ts";

describe("ChangeQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function watch(waiting: Promise<boolean>): { answer: boolean | null } {
    const seen: { answer: boolean | null } = { answer: null };
    void waiting.then(t => {
      seen.answer = t;
    });
    return seen;
  }

  it("answers its first change at once, a later one once the gap after the previous read has passed, and once for all the changes heard meanwhile", async () => {
    const stop: AbortController = new AbortController();
    const queue: ChangeQueue = new ChangeQueue(stop.signal);
    const first: boolean = await queue.nextAsync();
    const second: { answer: boolean | null } = watch(queue.nextAsync());
    queue.add();
    queue.add();
    await vi.advanceTimersByTimeAsync(99);
    const inGap: boolean | null = second.answer;
    await vi.advanceTimersByTimeAsync(1);
    const afterGap: boolean | null = second.answer;
    const waiting: Promise<boolean> = queue.nextAsync();
    const third: { answer: boolean | null } = watch(waiting);
    await vi.advanceTimersByTimeAsync(300);
    const unchanged: boolean | null = third.answer;
    queue.add();

    expect([first, inGap, afterGap, unchanged, await waiting]).toEqual([true, null, true, null, true]);
  });

  it("reads a page that reports a change every frame once a gap: in 950 ms of frames 10 ms apart, at once and then every 100 ms", async () => {
    const stop: AbortController = new AbortController();
    const queue: ChangeQueue = new ChangeQueue(stop.signal);
    let reads: number = 0;
    const reading: Promise<void> = (async () => {
      while (await queue.nextAsync())
        reads += 1;
    })();
    for (let frame: number = 0; frame < 95; frame += 1) {
      queue.add();
      await vi.advanceTimersByTimeAsync(10);
    }
    stop.abort();
    await reading;

    expect(reads).toBe(10);
  });

  it("answers false as soon as its signal aborts, for a wait in the gap or for a change, a change not yet read, and every wait after", async () => {
    const stop: AbortController = new AbortController();
    const queue: ChangeQueue = new ChangeQueue(stop.signal);
    await queue.nextAsync();
    const inGap: Promise<boolean> = queue.nextAsync();
    stop.abort();
    const pending: AbortController = new AbortController();
    const unread: ChangeQueue = new ChangeQueue(pending.signal);
    pending.abort();
    unread.add();
    const waited: AbortController = new AbortController();
    const waiting: ChangeQueue = new ChangeQueue(waited.signal);
    await waiting.nextAsync();
    const forChange: Promise<boolean> = waiting.nextAsync();
    await vi.advanceTimersByTimeAsync(100);
    waited.abort();

    expect([await inGap, await queue.nextAsync(), await unread.nextAsync(), await forChange]).toEqual([false, false, false, false]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
