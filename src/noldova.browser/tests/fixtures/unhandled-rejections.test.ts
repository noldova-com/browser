/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { UnhandledRejections } from "./unhandled-rejections.fixture.ts";

describe("UnhandledRejections", () => {
  it("gives the next unhandled rejection's reason and puts back the listeners it took", async () => {
    const listeners: readonly NodeJS.UnhandledRejectionListener[] = process.listeners("unhandledRejection");
    const bug: TypeError = new TypeError("Nobody awaited this.");
    const next: Promise<unknown> = UnhandledRejections.nextAsync();
    const taken: number = process.listenerCount("unhandledRejection");

    void Promise.reject(bug);

    expect([await next, taken, process.listeners("unhandledRejection")]).toEqual([bug, 1, listeners]);
  });

  it("puts back the listeners it took, and takes no later rejection, once stopped before a rejection came", () => {
    const listeners: readonly NodeJS.UnhandledRejectionListener[] = process.listeners("unhandledRejection");
    void UnhandledRejections.nextAsync();

    UnhandledRejections.stop();
    UnhandledRejections.stop();

    expect(process.listeners("unhandledRejection")).toEqual(listeners);
  });
});
