/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PendingNavigation } from "../../src/models/pending-navigation.ts";

describe("PendingNavigation", () => {
  // Whether the promise settled by the time the microtasks queued now ran.
  const isSettledAsync = async (promise: Promise<void>): Promise<boolean> => {
    let isSettled: boolean = false;
    void promise.then(() => {
      isSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    return isSettled;
  };

  it("waits for no navigation at first, so its end settles at once", async () => {
    const navigation: PendingNavigation = new PendingNavigation("main");

    expect([navigation.frameId, navigation.isPending, await isSettledAsync(navigation.ended)]).toEqual(["main", false, true]);
  });

  it("is pending from a navigation's start until its end, which settles the end it gave while pending", async () => {
    const navigation: PendingNavigation = new PendingNavigation("main");
    navigation.start();
    const ended: Promise<void> = navigation.ended;
    const pending: [boolean, boolean] = [navigation.isPending, await isSettledAsync(ended)];

    navigation.end();

    expect([pending, navigation.isPending, await isSettledAsync(ended)]).toEqual([[true, false], false, true]);
  });

  it("keeps one end through a second start while pending, and settles each start's promise at the next start", async () => {
    const navigation: PendingNavigation = new PendingNavigation("main");
    const first: Promise<void> = navigation.started;
    navigation.start();
    const ended: Promise<void> = navigation.ended;
    const second: Promise<void> = navigation.started;
    const before: [boolean, boolean] = [await isSettledAsync(first), await isSettledAsync(second)];

    navigation.start();
    navigation.end();

    expect([before, await isSettledAsync(second), await isSettledAsync(ended)]).toEqual([[true, false], true, true]);
  });

  it("gives a new end to a navigation that starts after the last one ended", async () => {
    const navigation: PendingNavigation = new PendingNavigation("main");
    navigation.start();
    navigation.end();
    navigation.start();

    expect([navigation.isPending, await isSettledAsync(navigation.ended)]).toEqual([true, false]);
  });

  it("ignores an end while no navigation is pending", () => {
    const navigation: PendingNavigation = new PendingNavigation("main");
    navigation.end();

    expect(navigation.isPending).toBe(false);
  });

  it("follows the main frame a later read names", () => {
    const navigation: PendingNavigation = new PendingNavigation("main");
    navigation.rename("main-2");

    expect(navigation.frameId).toBe("main-2");
  });
});
