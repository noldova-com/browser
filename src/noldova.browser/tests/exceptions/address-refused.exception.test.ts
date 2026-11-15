/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRefusal } from "@noldova/browser.protocol";
import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { AddressRefusedException } from "../../src/exceptions/address-refused.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";

describe("AddressRefusedException", () => {
  it("keeps its facts and its message", () => {
    const exception: AddressRefusedException = new AddressRefusedException(TypedAddressRefusal.NotWeb);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("AddressRefusedException");
    expect(exception.message).toBe("The address isn't an http or https address, so the browser never opens it.");
    expect(exception.refusal).toEqual(TypedAddressRefusal.NotWeb);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The address isn't an http or https address, so the browser never opens it.", "browser.originRefused"));
  });

  it("gives the agent each refusal in words rather than by its name", () => {
    const refusals: readonly TypedAddressRefusal[] = Object.values(TypedAddressRefusal);

    expect(refusals.map(t => new AddressRefusedException(t).message)).toEqual([
      "The text isn't a web address, so the browser never opens it.",
      "The address isn't an http or https address, so the browser never opens it.",
      "The address is longer than the browser opens, so it never opens it.",
      "The address carries a user name or password, so the browser never opens it.",
      "The address is on this computer or its network, which the browser opens only once the person names its origin in Settings, under Sites on this computer or network (browser.localSites); ask them to, or use another address.",
      "The address is a link-local or unspecified one, which the browser never opens."
    ]);
    expect(refusals.every(t => !new AddressRefusedException(t).message.includes(t))).toBe(true);
  });
});
