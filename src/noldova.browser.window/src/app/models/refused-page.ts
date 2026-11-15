/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RefusedPage {
  public readonly agentName: string;
  public readonly url: string;
  public readonly origin: string;

  public constructor(agentName: string, url: string, origin: string) {
    this.agentName = agentName;
    this.url = url;
    this.origin = origin;
  }
}
