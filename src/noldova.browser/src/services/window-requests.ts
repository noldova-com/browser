/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";

import { WindowRequestUnreadException } from "../exceptions/window-request-unread.exception.ts";

export class WindowRequests {
  public static read<T>(read: () => T): T {
    try {
      return read();
    }
    catch (error) {
      if (!(error instanceof JsonException))
        throw error;
      throw new WindowRequestUnreadException(error.path, new ExceptionOptions(error));
    }
  }
}
