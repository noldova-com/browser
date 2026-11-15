/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SessionPage {
  public readonly viewId: string;
  public readonly instance: string;
  public readonly profileKey: string;
  public readonly agentName: string;

  public constructor(viewId: string, instance: string, profileKey: string, agentName: string) {
    this.viewId = viewId;
    this.instance = instance;
    this.profileKey = profileKey;
    this.agentName = agentName;
  }
}
