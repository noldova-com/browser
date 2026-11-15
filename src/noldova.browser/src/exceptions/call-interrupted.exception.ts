/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";
import type { ToolAbortReason } from "@noldova/desktop.runtime";

import { CallFailureException } from "./call-failure.exception.ts";

export abstract class CallInterruptedException extends CallFailureException {
  public abstract readonly kind: ToolAbortReason;
  public override readonly moduleCode: string | null = null;

  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
