/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { BrowserWindowException } from "./browser-window.exception.ts";

export class PageOnOtherWorkspaceException extends BrowserWindowException {
  public override readonly name: string = "PageOnOtherWorkspaceException";
  public readonly instance: string;
  public readonly profileKey: string;

  public constructor(instance: string, profileKey: string) {
    super(Resources.formatPageOnOtherWorkspace(instance));

    this.instance = instance;
    this.profileKey = profileKey;
  }
}
