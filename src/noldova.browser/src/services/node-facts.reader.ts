/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { NodeFacts } from "../models/node-facts.ts";
import { NodePath } from "../models/node-path.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

export class NodeFactsReader {
  public static readNode(reply: JsonObject): NodeFacts {
    return NodeFactsReader.readFacts(NodeFactsReader.readObject(reply[Resources.nodeField]));
  }

  public static readAncestors(reply: JsonObject, backendNodeId: number): readonly NodeFacts[] | null {
    const pending: [JsonObject, readonly NodeFacts[]][] = [[NodeFactsReader.readObject(reply[Resources.rootField]), []]];
    for (let visit: [JsonObject, readonly NodeFacts[]] | undefined = pending.pop(); visit !== undefined; visit = pending.pop()) {
      const [node, ancestors]: [JsonObject, readonly NodeFacts[]] = visit;
      if (node[Resources.backendNodeIdField] === backendNodeId)
        return ancestors;

      const path: readonly NodeFacts[] = [...ancestors, NodeFactsReader.readFacts(node)];
      for (const child of NodeFactsReader.readChildren(node))
        pending.push([child, path]);
    }
    return null;
  }

  public static readFormNodes(reply: JsonObject, backendNodeId: number): readonly NodeFacts[] {
    const root: JsonObject = NodeFactsReader.readObject(reply[Resources.rootField]);
    const form: JsonObject | null = NodeFactsReader.findForm(root, backendNodeId);
    if (form === null)
      return [];
    const id: string | undefined = NodeFactsReader.readFacts(form).attributes.get(Resources.idAttribute);
    const linked: readonly JsonObject[] = id === undefined ? [] : NodeFactsReader.readAll(root)
      .filter(t => NodeFactsReader.readFacts(t).attributes.get(Resources.formAttribute) === id);
    return [...NodeFactsReader.readAll(form), ...linked].map(t => NodeFactsReader.readFacts(t));
  }

  public static readFormName(reply: JsonObject, backendNodeId: number): string {
    const root: JsonObject = NodeFactsReader.readObject(reply[Resources.rootField]);
    const form: JsonObject | null = NodeFactsReader.findForm(root, backendNodeId);
    if (form === null)
      return "";
    const attributes: ReadonlyMap<string, string> = NodeFactsReader.readFacts(form).attributes;
    const labels: string = (attributes.get(Resources.ariaLabelledByAttribute) ?? "").split(/\s+/).filter(t => t !== "")
      .map(id => NodeFactsReader.readAll(root).find(t => NodeFactsReader.readFacts(t).attributes.get(Resources.idAttribute) === id))
      .map(t => t === undefined ? "" : NodeFactsReader.readText(t))
      .join(" ");
    const names: readonly string[] = [labels, attributes.get(Resources.ariaLabelAttribute) ?? "", attributes.get(Resources.titleAttribute) ?? ""]
      .map(t => NodeFactsReader.collapse(t));
    return names.find(t => t !== "") ?? "";
  }

  public static readTitle(reply: JsonObject): string {
    const title: JsonObject | undefined = NodeFactsReader.readInOrder(NodeFactsReader.readObject(reply[Resources.rootField]))
      .find(t => t[Resources.nodeNameField] === Resources.titleElement);
    return title === undefined ? "" : NodeFactsReader.collapse(NodeFactsReader.readText(title));
  }

  public static holds(reply: JsonObject, backendNodeId: number): boolean {
    return NodeFactsReader.findNode(NodeFactsReader.readObject(reply[Resources.nodeField]), backendNodeId) !== null;
  }

  public static readBaseUrl(reply: JsonObject): string {
    const baseUrl: JsonValue | undefined = NodeFactsReader.readObject(reply[Resources.rootField])[Resources.baseURLField];
    if (typeof baseUrl !== "string")
      throw new MalformedReplyException();
    return baseUrl;
  }

  private static readFacts(node: JsonObject): NodeFacts {
    const nodeName: JsonValue | undefined = node[Resources.nodeNameField];
    const pairs: JsonValue = node[Resources.attributesField] ?? [];
    if (typeof nodeName !== "string" || !JsonShapes.isArray(pairs) || pairs.length % 2 !== 0)
      throw new MalformedReplyException();

    const attributes: Map<string, string> = new Map();
    for (let index: number = 0; index < pairs.length; index += 2) {
      const name: JsonValue | undefined = pairs[index];
      const value: JsonValue | undefined = pairs[index + 1];
      if (typeof name !== "string" || typeof value !== "string")
        throw new MalformedReplyException();
      attributes.set(name.toLowerCase(), value);
    }
    return new NodeFacts(nodeName.toUpperCase(), attributes);
  }

  private static findForm(root: JsonObject, backendNodeId: number): JsonObject | null {
    const found: NodePath | null = NodeFactsReader.findPath(root, backendNodeId);
    if (found === null)
      return null;
    const { node, ancestors }: NodePath = found;
    const named: string | undefined = NodeFactsReader.readFacts(node).attributes.get(Resources.formAttribute);
    return (named === undefined
      ? ancestors.findLast(t => NodeFactsReader.isForm(t, null))
      : NodeFactsReader.readAll(root).find(t => NodeFactsReader.isForm(t, named))) ?? null;
  }

  private static readText(node: JsonObject): string {
    return NodeFactsReader.readInOrder(node).flatMap(t => {
      const value: JsonValue | undefined = t[Resources.nodeValueField];
      return t[Resources.nodeNameField] === Resources.textNodeName && typeof value === "string" ? [value] : [];
    }).join("");
  }

  private static readInOrder(root: JsonObject): readonly JsonObject[] {
    const all: JsonObject[] = [];
    const pending: JsonObject[] = [root];
    for (let node: JsonObject | undefined = pending.pop(); node !== undefined; node = pending.pop()) {
      all.push(node);
      pending.push(...[...NodeFactsReader.readNodes(node[Resources.childrenField])].reverse());
    }
    return all;
  }

  private static collapse(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  private static findPath(root: JsonObject, backendNodeId: number): NodePath | null {
    const pending: NodePath[] = [new NodePath(root, [])];
    for (let visit: NodePath | undefined = pending.pop(); visit !== undefined; visit = pending.pop()) {
      const { node, ancestors }: NodePath = visit;
      if (node[Resources.backendNodeIdField] === backendNodeId)
        return visit;
      for (const child of NodeFactsReader.readChildren(node))
        pending.push(new NodePath(child, [...ancestors, node]));
    }
    return null;
  }

  private static readAll(root: JsonObject): readonly JsonObject[] {
    const all: JsonObject[] = [];
    const pending: JsonObject[] = [root];
    for (let node: JsonObject | undefined = pending.pop(); node !== undefined; node = pending.pop()) {
      all.push(node);
      pending.push(...NodeFactsReader.readChildren(node));
    }
    return all;
  }

  private static isForm(node: JsonObject, id: string | null): boolean {
    const facts: NodeFacts = NodeFactsReader.readFacts(node);
    return facts.nodeName === Resources.formElement && (id === null || facts.attributes.get(Resources.idAttribute) === id);
  }

  private static findNode(root: JsonObject, backendNodeId: number): JsonObject | null {
    const pending: JsonObject[] = [root];
    for (let node: JsonObject | undefined = pending.pop(); node !== undefined; node = pending.pop()) {
      if (node[Resources.backendNodeIdField] === backendNodeId)
        return node;
      pending.push(...NodeFactsReader.readChildren(node));
    }
    return null;
  }

  private static readChildren(node: JsonObject): readonly JsonObject[] {
    return [...NodeFactsReader.readNodes(node[Resources.childrenField]), ...NodeFactsReader.readNodes(node[Resources.shadowRootsField])];
  }

  private static readNodes(value: JsonValue | undefined): readonly JsonObject[] {
    if (value === undefined)
      return [];
    if (!JsonShapes.isArray(value))
      throw new MalformedReplyException();
    return value.map(t => NodeFactsReader.readObject(t));
  }

  private static readObject(value: JsonValue | undefined): JsonObject {
    if (!JsonShapes.isObject(value))
      throw new MalformedReplyException();
    return value;
  }
}
