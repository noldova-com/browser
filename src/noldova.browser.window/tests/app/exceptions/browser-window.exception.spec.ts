/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { AppNameAnswerMalformedException } from "../../../src/app/exceptions/app-name-answer-malformed.exception.ts";
import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { HeldPagesAnswerMalformedException } from "../../../src/app/exceptions/held-pages-answer-malformed.exception.ts";
import { LinkRefusedException } from "../../../src/app/exceptions/link-refused.exception.ts";
import { OpenPageArgumentsInvalidException } from "../../../src/app/exceptions/open-page-arguments-invalid.exception.ts";
import { PageClaimAnswerMalformedException } from "../../../src/app/exceptions/page-claim-answer-malformed.exception.ts";
import { PageInAnotherWindowException } from "../../../src/app/exceptions/page-in-another-window.exception.ts";
import { PageOnOtherWorkspaceException } from "../../../src/app/exceptions/page-on-other-workspace.exception.ts";
import { PageRecordAnswerMalformedException } from "../../../src/app/exceptions/page-record-answer-malformed.exception.ts";
import { PagesInactiveException } from "../../../src/app/exceptions/pages-inactive.exception.ts";
import { PaneUnavailableException } from "../../../src/app/exceptions/pane-unavailable.exception.ts";
import { TypedAddressAnswerMalformedException } from "../../../src/app/exceptions/typed-address-answer-malformed.exception.ts";

class ProbeException extends BrowserWindowException {
  public override readonly name: string = "ProbeException";

  public constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}

describe("BrowserWindowException", () => {
  it("carries its message, as a context Exception", () => {
    const error: BrowserWindowException = new ProbeException("The window failed.");

    expect(error).toBeInstanceOf(Exception);
    expect([error.name, error.message, error.cause]).toEqual(["ProbeException", "The window failed.", undefined]);
  });

  it("keeps the cause it is given through ExceptionOptions", () => {
    const cause: Error = new Error("The runtime closed.");

    const error: BrowserWindowException = new ProbeException("The window failed.", new ExceptionOptions(cause));

    expect([error.message, error.cause]).toEqual(["The window failed.", cause]);
  });

  it("is the base of every exception the window part owns", () => {
    const errors: readonly Error[] = [
      new AppNameAnswerMalformedException("$"),
      new HeldPagesAnswerMalformedException("$"),
      new LinkRefusedException("Local"),
      new OpenPageArgumentsInvalidException(),
      new PageClaimAnswerMalformedException("$"),
      new PageInAnotherWindowException("page-1"),
      new PageOnOtherWorkspaceException("page-1", "workspace-2"),
      new PageRecordAnswerMalformedException("$"),
      new PagesInactiveException(),
      new PaneUnavailableException(),
      new TypedAddressAnswerMalformedException("$")
    ];

    expect(errors.filter(t => !(t instanceof BrowserWindowException)).map(t => t.name)).toEqual([]);
  });
});
