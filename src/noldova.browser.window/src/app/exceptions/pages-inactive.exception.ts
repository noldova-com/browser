/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { BrowserWindowException } from "./browser-window.exception.ts";

export class PagesInactiveException extends BrowserWindowException {
  public override readonly name: string = "PagesInactiveException";

  public constructor(appName: string | null) {
    super(Resources.formatPagesInactive(appName));
  }
}
