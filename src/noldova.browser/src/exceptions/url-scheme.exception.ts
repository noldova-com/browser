/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { InvalidInputException } from "./invalid-input.exception.ts";

export class UrlSchemeException extends InvalidInputException {
  public constructor() {
    super(Resources.urlScheme);
  }
}
