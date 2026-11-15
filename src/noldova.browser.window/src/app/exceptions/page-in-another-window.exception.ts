/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { BrowserWindowException } from "./browser-window.exception.ts";

export class PageInAnotherWindowException extends BrowserWindowException {
  public override readonly name: string = "PageInAnotherWindowException";
  public readonly instance: string;

  public constructor(instance: string) {
    super(Resources.formatPageInAnotherWindow(instance));

    this.instance = instance;
  }
}
