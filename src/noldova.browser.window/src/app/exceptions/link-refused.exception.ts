/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TypedAddressRefusal } from "@noldova/browser.protocol";

import { Resources } from "../../resources.ts";
import { BrowserWindowException } from "./browser-window.exception.ts";

export class LinkRefusedException extends BrowserWindowException {
  public override readonly name: string = "LinkRefusedException";
  public readonly reason: TypedAddressRefusal;

  public constructor(reason: TypedAddressRefusal) {
    super(Resources.formatLinkRefused(reason));

    this.reason = reason;
  }
}
