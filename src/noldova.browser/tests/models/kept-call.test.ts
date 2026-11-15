/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { KeptCall } from "../../src/models/kept-call.ts";

describe("KeptCall", () => {
  it("keeps its method and parameters, and whether it went out since the view's last start, from not yet", () => {
    const call: KeptCall = new KeptCall("Runtime.addBinding", { name: "noldovaBrowserChanged", executionContextName: "noldova-browser-changes" });
    const before: boolean = call.isSent;
    call.markSent();
    const sent: boolean = call.isSent;
    call.markUnsent();

    expect([call.method, call.params, before, sent, call.isSent]).toEqual(["Runtime.addBinding",
      { name: "noldovaBrowserChanged", executionContextName: "noldova-browser-changes" }, false, true, false]);
  });
});
