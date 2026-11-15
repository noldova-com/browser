/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { CallTimedOutException } from "./call-timed-out.exception.ts";

export class CallDeadlineReachedException extends CallTimedOutException {
  public constructor(cause?: unknown) {
    super(Resources.deadlineReached, new ExceptionOptions(cause));
  }
}
