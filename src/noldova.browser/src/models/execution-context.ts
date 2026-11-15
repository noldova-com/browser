/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ExecutionContext {
  public readonly id: number;
  public readonly uniqueId: string;
  public readonly name: string;
  public readonly frameId: string;

  public constructor(id: number, uniqueId: string, name: string, frameId: string) {
    this.id = id;
    this.uniqueId = uniqueId;
    this.name = name;
    this.frameId = frameId;
  }
}
