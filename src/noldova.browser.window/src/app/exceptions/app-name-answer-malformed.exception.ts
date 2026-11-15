/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../../resources.ts";
import { RuntimeAnswerMalformedException } from "./runtime-answer-malformed.exception.ts";

export class AppNameAnswerMalformedException extends RuntimeAnswerMalformedException {
  public override readonly name: string = "AppNameAnswerMalformedException";

  public constructor(path: string, options?: ExceptionOptions) {
    super(Resources.appNameAnswer, path, options);
  }
}
