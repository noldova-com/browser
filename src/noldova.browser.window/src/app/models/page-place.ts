/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PagePlace {
  public readonly profileKey: string;
  public readonly url: string;

  public constructor(profileKey: string, url: string) {
    this.profileKey = profileKey;
    this.url = url;
  }
}
