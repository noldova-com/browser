/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";
import { ToolAbortReason, ToolFailureCode } from "@noldova/desktop.runtime";

import { CallInterruptedException } from "./call-interrupted.exception.ts";

export abstract class CallTimedOutException extends CallInterruptedException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.TimedOut;
  public override readonly kind: ToolAbortReason = ToolAbortReason.DeadlineReached;

  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
