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

  // Each node, in the tree's order, with its name, in which every field value of the node and of the nodes below it is masked, and every
  // field value of the elements its name is built from through `aria-labelledby` and of the nodes below them, wherever they are: the engine
  // builds a label's, a container's or a labelled element's name from the fields in it, and hides only a password's value.
  public static readMaskedNames(tree: AccessibilityTree): readonly MaskedName[] {
    const byId: ReadonlyMap<string, AccessibilityNode> = new Map<string, AccessibilityNode>(tree.nodes.map(t => [t.id, t]));
    const byElement: Map<number, AccessibilityNode> = new Map<number, AccessibilityNode>();
    const parents: Map<string, AccessibilityNode> = new Map<string, AccessibilityNode>();
    for (const node of tree.nodes) {
      if (!Object.isNull(node.backendNodeId))
        byElement.set(node.backendNodeId, node);
      for (const child of node.childIds)
        parents.set(child, node);
    }
    const names: Map<string, string> = new Map<string, string>();
    for (const node of tree.nodes) {
      const referenced: readonly AccessibilityNode[] = AccessibilitySnapshot.readBelow(node.labelledBy.flatMap(t => byElement.get(t) ?? []), byId);
      const values: readonly string[] = [node, ...referenced].map(t => t.value).filter(t => t !== "");
      if (values.length === 0)
        continue;
      // A page's tree has no cycle, but a reply that names a node as its own ancestor must not loop.
      const seen: Set<string> = new Set<string>();
      for (let at: AccessibilityNode | undefined = node; !Object.isUndefined(at) && !seen.has(at.id); at = parents.get(at.id)) {
        seen.add(at.id);
        names.set(at.id, values.reduce((name, t) => name.replaceAll(t, Resources.maskedValue), names.get(at.id) ?? at.name));
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
      AccessibilitySnapshot.readFocused(value[Resources.propertiesField] ?? []),
      AccessibilitySnapshot.readLabelledBy(value[Resources.nameField])
    );
  }

  // The elements a name's `aria-labelledby` source gives, by their element ids; none where the name has no such source.
  private static readLabelledBy(name: JsonValue | undefined): readonly number[] {
    const sources: JsonValue | undefined = JsonShapes.isObject(name) ? name[Resources.sourcesField] : undefined;
    if (!JsonShapes.isArray(sources))
      return [];
    return sources.flatMap(source => {
      const value: JsonValue | undefined = JsonShapes.isObject(source) && source[Resources.attributeField] === Resources.ariaLabelledByAttribute
        ? source[Resources.attributeValueField] : undefined;
      const related: JsonValue | undefined = JsonShapes.isObject(value) ? value[Resources.relatedNodesField] : undefined;
      return JsonShapes.isArray(related) ? related.flatMap(t => {
        const element: JsonValue | undefined = JsonShapes.isObject(t) ? t[Resources.backendDOMNodeIdField] : undefined;
        return Object.isNumber(element) ? [element] : [];
      }) : [];
    });
  }

  // The nodes and every node below them. A page's tree has no cycle, but a reply that names a node as its own descendant must not loop.
  private static readBelow(nodes: readonly AccessibilityNode[], byId: ReadonlyMap<string, AccessibilityNode>): readonly AccessibilityNode[] {
    const below: AccessibilityNode[] = [];
    const seen: Set<string> = new Set<string>();
    const pending: AccessibilityNode[] = [...nodes];
    for (let at: AccessibilityNode | undefined = pending.pop(); !Object.isUndefined(at); at = pending.pop()) {
      if (seen.has(at.id))
        continue;
      seen.add(at.id);
      below.push(at);
      pending.push(...at.childIds.flatMap(t => byId.get(t) ?? []));
    }
    return below;
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
