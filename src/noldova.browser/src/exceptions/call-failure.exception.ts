/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";
import { ToolFailure, type ToolFailureCode } from "@noldova/desktop.runtime";

import { BrowserRuntimeException } from "./browser-runtime.exception.ts";

export abstract class CallFailureException extends BrowserRuntimeException {
  public abstract readonly reason: ToolFailureCode;
  public abstract readonly moduleCode: string | null;

  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }

  public toFailure(): ToolFailure {
    return new ToolFailure(this.reason, this.message, this.moduleCode);
  }
}
