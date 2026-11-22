/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { CallFailureException } from "./call-failure.exception.ts";

export class ScreenshotChangedException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Stale;
  public override readonly moduleCode: string | null = null;

  public constructor() {
    super(Resources.screenshotChanged);
  }
}
