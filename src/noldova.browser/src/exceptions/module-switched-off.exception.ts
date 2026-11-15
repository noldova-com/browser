/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { ToolAbortReason, ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { CallInterruptedException } from "./call-interrupted.exception.ts";

export class ModuleSwitchedOffException extends CallInterruptedException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Unavailable;
  public override readonly kind: ToolAbortReason = ToolAbortReason.SwitchedOff;

  public constructor(cause?: unknown) {
    super(Resources.switchedOff, new ExceptionOptions(cause));
  }
}
