/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class NodeFacts {
  public readonly nodeName: string;
  public readonly attributes: ReadonlyMap<string, string>;

  public constructor(nodeName: string, attributes: ReadonlyMap<string, string>) {
    this.nodeName = nodeName;
    this.attributes = attributes;
  }
}
