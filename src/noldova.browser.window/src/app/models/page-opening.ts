/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PageOpening {
  public readonly profileKey: string;
  public readonly url: string | null;
  public readonly instance: string | null;

  public constructor(profileKey: string, url: string | null, instance: string | null) {
    this.profileKey = profileKey;
    this.url = url;
    this.instance = instance;
  }
}
