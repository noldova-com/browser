/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";
import { ToolFailureCode } from "@noldova/desktop.runtime";

import { CallFailureException } from "./call-failure.exception.ts";

export abstract class CallDeniedException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Denied;

  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
