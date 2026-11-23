/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { ElementFacts } from "../models/element-facts.ts";
import { NodeFacts } from "../models/node-facts.ts";
import { PageFacts } from "../models/page-facts.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

export class NodeFactsReader {
  public static readNode(reply: JsonObject): NodeFacts {
    return NodeFactsReader.readFacts(NodeFactsReader.readObject(reply[Resources.nodeField]));
  }

  // The path the pinned function gives, from the document to the element, or none outside the main frame's document.
  public static readPath(reply: JsonObject): readonly NodeFacts[] | null {
    const path: JsonValue | undefined = NodeFactsReader.readFunctionFacts(reply)[Resources.pathField];
    return path === null ? null : NodeFactsReader.readPairs(path);
  }

  // The pinned function's facts with the form's subtree, when it was read: the path, the form's elements, its own and those that name it,
  // the form's name, and the page's title and base URL.
  public static readElement(reply: JsonObject, form: readonly NodeFacts[] | null): ElementFacts {
    const facts: JsonObject = NodeFactsReader.readFunctionFacts(reply);
    const linked: readonly NodeFacts[] = NodeFactsReader.readPairs(facts[Resources.linkedField]);
    const formName: JsonValue | undefined = facts[Resources.formNameField];
    const title: JsonValue | undefined = facts[Resources.titleField];
    const baseUrl: JsonValue | undefined = facts[Resources.baseUrlField];
    if (typeof formName !== "string" || typeof title !== "string" || typeof baseUrl !== "string")
      throw new MalformedReplyException();
    return new ElementFacts(NodeFactsReader.readPath(reply), form === null ? [] : [...form, ...linked], formName, new PageFacts(baseUrl, title));
  }

  // Every node of a described subtree, the described node first, through shadow roots.
  public static readSubtree(reply: JsonObject): readonly NodeFacts[] {
    const all: NodeFacts[] = [];
    const pending: JsonObject[] = [NodeFactsReader.readObject(reply[Resources.nodeField])];
    for (let node: JsonObject | undefined = pending.pop(); node !== undefined; node = pending.pop()) {
      all.push(NodeFactsReader.readFacts(node));
      pending.push(...[...NodeFactsReader.readChildren(node)].reverse());
    }
    return all;
  }

  // The described node's backend id.
  public static readBackendNodeId(reply: JsonObject): number {
    const id: JsonValue | undefined = NodeFactsReader.readObject(reply[Resources.nodeField])[Resources.backendNodeIdField];
    if (typeof id !== "number")
      throw new MalformedReplyException();
    return id;
  }

  // Every node inside the described node's own closed shadow roots, through the shadow roots below them.
  public static readClosedRoots(reply: JsonObject): readonly NodeFacts[] {
    return NodeFactsReader.readNodes(NodeFactsReader.readObject(reply[Resources.nodeField])[Resources.shadowRootsField])
      .filter(t => t[Resources.shadowRootTypeField] === Resources.closedRootType)
      .flatMap(t => NodeFactsReader.readSubtree({ [Resources.nodeField]: t }));
  }

  public static holds(reply: JsonObject, backendNodeId: number): boolean {
    return NodeFactsReader.findNode(NodeFactsReader.readObject(reply[Resources.nodeField]), backendNodeId) !== null;
  }

  private static readFunctionFacts(reply: JsonObject): JsonObject {
    const result: JsonValue | undefined = reply[Resources.resultField];
    return NodeFactsReader.readObject(JsonShapes.isObject(result) ? result[Resources.valueField] : undefined);
  }

  // Each node as the pinned function gives it, its name and its attributes as name and value in turn, read as the protocol's nodes are.
  private static readPairs(value: JsonValue | undefined): readonly NodeFacts[] {
    if (!JsonShapes.isArray(value))
      throw new MalformedReplyException();
    return value.map(t => {
      if (!JsonShapes.isArray(t) || t.length !== 2)
        throw new MalformedReplyException();
      return NodeFactsReader.readNamed(t[0], t[1]);
    });
  }

  private static readFacts(node: JsonObject): NodeFacts {
    return NodeFactsReader.readNamed(node[Resources.nodeNameField], node[Resources.attributesField] ?? []);
  }

  private static readNamed(nodeName: JsonValue | undefined, pairs: JsonValue | undefined): NodeFacts {
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
