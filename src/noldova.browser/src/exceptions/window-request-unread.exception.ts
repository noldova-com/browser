/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { WindowRequestMalformedException } from "./window-request-malformed.exception.ts";

export class WindowRequestUnreadException extends WindowRequestMalformedException {
  public readonly path: string;

  public constructor(path: string, options?: ExceptionOptions) {
    super(Resources.formatWindowRequestUnread(path), options);
    this.path = path;
  }
}
