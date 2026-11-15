/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShownElement {
  public readonly role: string;
  public readonly name: string;
  public readonly isSecret: boolean;

  public constructor(role: string, name: string, isSecret: boolean) {
    this.role = role;
    this.name = name;
    this.isSecret = isSecret;
  }
}
