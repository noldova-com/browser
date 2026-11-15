/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class KeyDefinition {
  public readonly key: string;
  public readonly code: string;
  public readonly keyCode: number;
  public readonly text: string;

  public constructor(key: string, code: string, keyCode: number, text: string) {
    this.key = key;
    this.code = code;
    this.keyCode = keyCode;
    this.text = text;
  }
}
