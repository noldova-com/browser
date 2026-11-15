/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { ToolFailureCode, type WebViewFailureException } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { CallFailureException } from "./call-failure.exception.ts";

export class ViewsUnavailableException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Unavailable;
  public override readonly moduleCode: string | null = Resources.viewsUnavailableCode;

  public constructor(cause: WebViewFailureException) {
    super(Resources.viewsUnavailable, new ExceptionOptions(cause));
  }
}
