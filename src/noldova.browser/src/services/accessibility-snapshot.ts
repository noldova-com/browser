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
import { MaskedName } from "../models/masked-name.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

export class AccessibilitySnapshot {
  public static readNodes(reply: JsonObject): AccessibilityTree {
    const nodes: JsonValue | undefined = reply[Resources.nodesField];
    if (!JsonShapes.isArray(nodes))
      throw new MalformedReplyException();
    const [root, ...rest]: readonly JsonValue[] = nodes;
    if (Object.isUndefined(root))
      throw new MalformedReplyException();
    return new AccessibilityTree(AccessibilitySnapshot.readNode(root), rest.map(t => AccessibilitySnapshot.readNode(t)));
  }

  public static readChildren(reply: JsonObject): readonly AccessibilityNode[] {
    const nodes: JsonValue | undefined = reply[Resources.nodesField];
    if (!JsonShapes.isArray(nodes))
      throw new MalformedReplyException();
    return nodes.map(t => AccessibilitySnapshot.readNode(t));
  }

  // Each node, in the tree's order, with its name, in which every field value of the node and of the nodes below it is masked: the engine
  // builds a label's or a container's name from the fields inside it, and hides only a password's value.
  public static readMaskedNames(tree: AccessibilityTree): readonly MaskedName[] {
    const names: Map<string, string> = new Map<string, string>();
    const parents: Map<string, AccessibilityNode> = new Map<string, AccessibilityNode>();
    for (const node of tree.nodes)
      for (const child of node.childIds)
        parents.set(child, node);
    for (const node of tree.nodes.filter(t => t.value !== "")) {
      // A page's tree has no cycle, but a reply that names a node as its own ancestor must not loop.
      const seen: Set<string> = new Set<string>();
      for (let at: AccessibilityNode | undefined = node; !Object.isUndefined(at) && !seen.has(at.id); at = parents.get(at.id)) {
        seen.add(at.id);
        names.set(at.id, (names.get(at.id) ?? at.name).replaceAll(node.value, Resources.maskedValue));
      }
    }
    return tree.nodes.map(t => new MaskedName(t, names.get(t.id) ?? t.name));
  }

  public static readTitle(tree: AccessibilityTree): string {
    return tree.root.name;
  }

  public static findFocused(nodes: readonly AccessibilityNode[]): AccessibilityNode | null {
    return nodes.findLast(t => t.isFocused && !Object.isNull(t.backendNodeId)) ?? null;
  }

  private static readNode(value: JsonValue): AccessibilityNode {
    if (!JsonShapes.isObject(value))
      throw new MalformedReplyException();
    const id: JsonValue | undefined = value[Resources.nodeIdField];
    const isIgnored: JsonValue = value[Resources.ignoredField] ?? false;
    const backendNodeId: JsonValue = value[Resources.backendDOMNodeIdField] ?? null;
    if (!Object.isString(id) || !Object.isBoolean(isIgnored) || (!Object.isNull(backendNodeId) && !Object.isNumber(backendNodeId)))
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
      if (!Object.isString(id))
        throw new MalformedReplyException();
      ids.push(id);
    }
    return ids;
  }

  private static readText(value: JsonValue | undefined): string {
    if (!JsonShapes.isObject(value))
      return "";
    const text: JsonValue | undefined = value[Resources.valueField];
    if (Object.isString(text))
      return text;
    return Object.isNumber(text) || Object.isBoolean(text) ? String(text) : "";
  }
}
