/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class KeyShortcut {
  public readonly other: string;
  public readonly mac: string;

  public constructor(other: string, mac: string) {
    this.other = other;
    this.mac = mac;
  }
}
