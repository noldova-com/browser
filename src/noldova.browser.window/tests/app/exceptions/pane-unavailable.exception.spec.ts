/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { PaneUnavailableException } from "../../../src/app/exceptions/pane-unavailable.exception.ts";

describe("PaneUnavailableException", () => {
  it("names itself and says the pane has no embedded view, or the host closed it, as a window exception", () => {
    const error: PaneUnavailableException = new PaneUnavailableException();

    expect(error).toBeInstanceOf(BrowserWindowException);
    expect([error.name, error.message]).toEqual(["PaneUnavailableException", "The pane has no embedded view, or the host closed it."]);
  });
});
