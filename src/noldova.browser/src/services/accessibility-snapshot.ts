/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { AccessibilityNode } from "../models/accessibility-node.ts";
import { AccessibilityTree } from "../models/accessibility-tree.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

export class AccessibilitySnapshot {
  public static readNodes(reply: JsonObject): AccessibilityTree {
    const nodes: JsonValue | undefined = reply[Resources.nodesField];
    if (!JsonShapes.isArray(nodes))
      throw new MalformedReplyException();
    const [root, ...rest]: readonly JsonValue[] = nodes;
    if (root === undefined)
      throw new MalformedReplyException();
    return new AccessibilityTree(AccessibilitySnapshot.readNode(root), rest.map(t => AccessibilitySnapshot.readNode(t)));
  }

  public static readChildren(reply: JsonObject): readonly AccessibilityNode[] {
    const nodes: JsonValue | undefined = reply[Resources.nodesField];
    if (!JsonShapes.isArray(nodes))
      throw new MalformedReplyException();
    return nodes.map(t => AccessibilitySnapshot.readNode(t));
  }

  public static readTitle(tree: AccessibilityTree): string {
    return tree.root.name;
  }

  public static findFocused(nodes: readonly AccessibilityNode[]): AccessibilityNode | null {
    return nodes.findLast(t => t.isFocused && t.backendNodeId !== null) ?? null;
  }

  private static readNode(value: JsonValue): AccessibilityNode {
    if (!JsonShapes.isObject(value))
      throw new MalformedReplyException();
    const id: JsonValue | undefined = value[Resources.nodeIdField];
    const isIgnored: JsonValue = value[Resources.ignoredField] ?? false;
    const backendNodeId: JsonValue = value[Resources.backendDOMNodeIdField] ?? null;
    if (typeof id !== "string" || typeof isIgnored !== "boolean" || (backendNodeId !== null && typeof backendNodeId !== "number"))
      throw new MalformedReplyException();
    return new AccessibilityNode(
      id,
      isIgnored,
      AccessibilitySnapshot.readText(value[Resources.roleField]),
      AccessibilitySnapshot.readText(value[Resources.nameField]),
      AccessibilitySnapshot.readText(value[Resources.valueField]),
      AccessibilitySnapshot.readIds(value[Resources.childIdsField] ?? []),
      backendNodeId,
      AccessibilitySnapshot.readFocused(value[Resources.propertiesField] ?? [])
    );
  }

  private static readFocused(value: JsonValue): boolean {
    if (!JsonShapes.isArray(value))
      throw new MalformedReplyException();
    return value.some(t => JsonShapes.isObject(t) && t[Resources.nameField] === Resources.focusedProperty && AccessibilitySnapshot.readText(t[Resources.valueField]) === Resources.trueValue);
  }

  private static readIds(value: JsonValue): readonly string[] {
    if (!JsonShapes.isArray(value))
      throw new MalformedReplyException();
    const ids: string[] = [];
    for (const id of value) {
      if (typeof id !== "string")
        throw new MalformedReplyException();
      ids.push(id);
    }
    return ids;
  }

  private static readText(value: JsonValue | undefined): string {
    if (!JsonShapes.isObject(value))
      return "";
    const text: JsonValue | undefined = value[Resources.valueField];
    if (typeof text === "string")
      return text;
    return typeof text === "number" || typeof text === "boolean" ? String(text) : "";
  }
}
