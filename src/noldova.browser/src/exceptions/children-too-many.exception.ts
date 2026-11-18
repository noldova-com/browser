/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { CallTooLargeException } from "./call-too-large.exception.ts";

export class ChildrenTooManyException extends CallTooLargeException {
  public constructor(role: string, count: number, cause?: unknown) {
    super(Resources.formatChildrenTooMany(role, count), new ExceptionOptions(cause));
  }
}
