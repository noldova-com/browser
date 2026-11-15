/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressAnswerKind } from "@noldova/browser.protocol";

export class ReadAddress {
  public readonly kind: typeof TypedAddressAnswerKind.Allowed;
  public readonly url: string;

  public constructor(url: string) {
    this.kind = TypedAddressAnswerKind.Allowed;
    this.url = url;
  }
}
