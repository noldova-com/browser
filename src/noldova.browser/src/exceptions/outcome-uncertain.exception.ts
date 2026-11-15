/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { CallFailureException } from "./call-failure.exception.ts";

export class OutcomeUncertainException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.OutcomeUncertain;
  public override readonly moduleCode: string | null = null;
  public readonly endedCode: string;

  public constructor(endedCode: string, cause: unknown) {
    super(Resources.formatOutcomeUncertain(endedCode), new ExceptionOptions(cause));

    this.endedCode = endedCode;
  }
}
