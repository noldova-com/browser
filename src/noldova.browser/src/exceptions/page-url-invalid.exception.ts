/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { WindowRequestMalformedException } from "./window-request-malformed.exception.ts";

export class PageUrlInvalidException extends WindowRequestMalformedException {
  public constructor() {
    super(Resources.pageUrl);
  }
}
