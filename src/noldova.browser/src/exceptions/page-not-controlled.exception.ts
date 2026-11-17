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

// Noldova Desktop didn't mark the page's view as controlled, so a hidden page may not draw and an input may not reach it: nothing was done.
export class PageNotControlledException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Unavailable;
  public override readonly moduleCode: string | null = Resources.pageNotControlledCode;

  public constructor(viewId: string, cause: unknown) {
    super(Resources.formatPageNotControlled(viewId, cause instanceof Error ? cause.message : String(cause)), new ExceptionOptions(cause));
  }
}
