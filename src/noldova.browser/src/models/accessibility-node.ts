/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AccessibilityNode {
  public readonly id: string;
  public readonly isIgnored: boolean;
  public readonly role: string;
  public readonly name: string;
  public readonly value: string;
  public readonly childIds: readonly string[];
  public readonly backendNodeId: number | null;
  public readonly isFocused: boolean;

  public constructor(id: string, isIgnored: boolean, role: string, name: string, value: string, childIds: readonly string[], backendNodeId: number | null, isFocused: boolean) {
    this.id = id;
    this.isIgnored = isIgnored;
    this.role = role;
    this.name = name;
    this.value = value;
    this.childIds = childIds;
    this.backendNodeId = backendNodeId;
    this.isFocused = isFocused;
  }
}
