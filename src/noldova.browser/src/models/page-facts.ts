/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PageFacts {
  public readonly baseUrl: string;
  public readonly title: string;

  public constructor(baseUrl: string, title: string) {
    this.baseUrl = baseUrl;
    this.title = title;
  }
}
