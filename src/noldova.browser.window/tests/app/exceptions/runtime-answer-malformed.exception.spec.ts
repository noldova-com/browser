/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { AppNameAnswerMalformedException } from "../../../src/app/exceptions/app-name-answer-malformed.exception.ts";
import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { HeldPagesAnswerMalformedException } from "../../../src/app/exceptions/held-pages-answer-malformed.exception.ts";
import { PageActivitiesAnswerMalformedException } from "../../../src/app/exceptions/page-activities-answer-malformed.exception.ts";
import { PageActivityEventMalformedException } from "../../../src/app/exceptions/page-activity-event-malformed.exception.ts";
import { PageClaimAnswerMalformedException } from "../../../src/app/exceptions/page-claim-answer-malformed.exception.ts";
import { PageRecordAnswerMalformedException } from "../../../src/app/exceptions/page-record-answer-malformed.exception.ts";
import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";
import { TypedAddressAnswerMalformedException } from "../../../src/app/exceptions/typed-address-answer-malformed.exception.ts";

describe("RuntimeAnswerMalformedException", () => {
  it("is the window exception of every runtime part's answer that isn't its shape", () => {
    const errors: readonly Error[] = [new AppNameAnswerMalformedException("$"), new HeldPagesAnswerMalformedException("$"), new PageActivitiesAnswerMalformedException("$"),
      new PageActivityEventMalformedException("$"), new PageClaimAnswerMalformedException("$"), new PageRecordAnswerMalformedException("$"),
      new TypedAddressAnswerMalformedException("$")];

    expect(errors.map(t => t instanceof RuntimeAnswerMalformedException && t instanceof BrowserWindowException)).toEqual([true, true, true, true, true, true, true]);
  });
});
