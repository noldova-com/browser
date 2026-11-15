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
import { CutText } from "../models/cut-text.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import { OutputLimits } from "./output-limits.ts";

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

  public static readTitle(tree: AccessibilityTree): string {
    return tree.root.name;
  }

  public static typedFields(tree: AccessibilityTree): readonly number[] {
    const fields: number[] = [];
    for (const node of tree.nodes)
      if (node.backendNodeId !== null && node.value !== "" && Resources.typedRoles.has(node.role))
        fields.push(node.backendNodeId);
    return fields;
  }

  public static write(tree: AccessibilityTree, secrets: ReadonlySet<number>, issue: (backendNodeId: number) => string, maximumBytes: number): CutText {
    const byId: ReadonlyMap<string, AccessibilityNode> = new Map(tree.nodes.map(t => [t.id, t]));
    const visited: Set<string> = new Set();
    const lines: string[] = [];
    let bytes: number = 0;
    const pending: [AccessibilityNode, number][] = [[tree.root, 0]];
    for (let visit: [AccessibilityNode, number] | undefined = pending.pop(); visit !== undefined; visit = pending.pop()) {
      const [node, depth]: [AccessibilityNode, number] = visit;
      if (visited.has(node.id))
        continue;
      visited.add(node.id);

      const isShown: boolean = !node.isIgnored && !(Resources.liftedRoles.has(node.role) && node.name === "");
      const isSecret: boolean = AccessibilitySnapshot.isMasked(node, secrets);
      if (isShown) {
        const line: string = AccessibilitySnapshot.formatLine(node, depth, isSecret, issue);
        const lineBytes: number = OutputLimits.byteLength(line) + 1;
        if (bytes + lineBytes > maximumBytes)
          return new CutText(lines.join(Resources.lineSeparator), true);
        lines.push(line);
        bytes += lineBytes;
      }
      if (isSecret)
        continue;
      const childDepth: number = isShown ? depth + 1 : depth;
      for (const childId of [...node.childIds].reverse()) {
        const child: AccessibilityNode | undefined = byId.get(childId);
        if (child !== undefined)
          pending.push([child, childDepth]);
      }
    }
    return new CutText(lines.join(Resources.lineSeparator), false);
  }

  public static findFocused(tree: AccessibilityTree): number | null {
    return tree.nodes.findLast(t => t.isFocused && t.backendNodeId !== null)?.backendNodeId ?? null;
  }

  private static isMasked(node: AccessibilityNode, secrets: ReadonlySet<number>): boolean {
    if (node.value === "" || !Resources.typedRoles.has(node.role))
      return false;
    return node.backendNodeId === null || secrets.has(node.backendNodeId);
  }

  private static formatLine(node: AccessibilityNode, depth: number, isSecret: boolean, issue: (backendNodeId: number) => string): string {
    const parts: string[] = [Resources.formatSnapshotNode(depth, node.role)];
    if (node.name !== "")
      parts.push(JSON.stringify(node.name));
    if (node.value !== "")
      parts.push(Resources.formatSnapshotValue(isSecret ? Resources.maskedValue : node.value));
    if (node.backendNodeId !== null && Resources.actionableRoles.has(node.role))
      parts.push(Resources.formatSnapshotReference(issue(node.backendNodeId)));
    return parts.join(Resources.snapshotPartSeparator);
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
