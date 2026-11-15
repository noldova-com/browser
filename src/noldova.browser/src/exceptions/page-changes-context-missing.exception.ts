/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { BrowserRuntimeException } from "./browser-runtime.exception.ts";

export class PageChangesContextMissingException extends BrowserRuntimeException {
  public readonly viewId: string;
  public readonly frameId: string;

  public constructor(viewId: string, frameId: string) {
    super(Resources.pageChangesContextMissing);

    this.viewId = viewId;
    this.frameId = frameId;
  }
}
