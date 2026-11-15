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

export class PageChangedAfterGrantException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Stale;
  public override readonly moduleCode: string | null = null;

  public constructor(cause?: unknown) {
    super(Resources.changedAfterGrant, new ExceptionOptions(cause));
  }
}
