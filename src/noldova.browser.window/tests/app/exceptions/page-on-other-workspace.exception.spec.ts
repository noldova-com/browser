/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { PageOnOtherWorkspaceException } from "../../../src/app/exceptions/page-on-other-workspace.exception.ts";

describe("PageOnOtherWorkspaceException", () => {
  it("names the page and the workspace asked for, as a window exception", () => {
    const error: PageOnOtherWorkspaceException = new PageOnOtherWorkspaceException("page-1", "workspace-2");

    expect(error).toBeInstanceOf(BrowserWindowException);
    expect([error.name, error.message, error.instance, error.profileKey]).toEqual(["PageOnOtherWorkspaceException", "The page page-1 is open on another workspace.",
      "page-1", "workspace-2"]);
  });
});
