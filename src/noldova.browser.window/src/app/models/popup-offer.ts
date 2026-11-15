/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PopupOffer {
  public readonly address: string;
  public readonly origin: string | null;
  public readonly hadRecentInput: boolean;

  public constructor(address: string, origin: string | null, hadRecentInput: boolean) {
    this.address = address;
    this.origin = origin;
    this.hadRecentInput = hadRecentInput;
  }
}
