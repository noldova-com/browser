/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShownPage {
  public readonly url: string;
  public readonly title: string;

  public constructor(url: string, title: string) {
    this.url = url;
    this.title = title;
  }
}
