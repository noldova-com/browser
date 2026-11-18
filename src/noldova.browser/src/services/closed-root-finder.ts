/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { ReplyTooLargeException } from "../exceptions/reply-too-large.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { ClosedRoots } from "../models/closed-roots.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import type { ViewCalls } from "./view-calls.ts";

// The hosts of the document's closed shadow roots, which the page's own script and the snapshot function can't see, found exactly by
// describing the document through shadow roots in one answer. When that answer passes the reply's bound, the node is described one level
// deep and each of its children and open roots whole, the same way again for any that still passes it, so only a very large page pays the
// extra calls. A node whose own one level passes the bound can't be split, so the closed roots under it aren't searched: the page still
// walks it, and a host there shows only its own line. Listing such a node's children one at a time instead would take a call for each.
// The search has a time of its own, after which the parts left aren't searched either.
interface SearchTime {
  until: number;
}

export class ClosedRootFinder {
  private readonly calls: ViewCalls;

  public constructor(calls: ViewCalls) {
    this.calls = calls;
  }

  public async findAsync(viewId: string, options: CallOptions): Promise<ClosedRoots> {
    const document: JsonObject = await this.calls.sendAsync(viewId, Resources.getDocumentMethod, { depth: Resources.documentOnlyDepth, pierce: true }, options);
    const root: JsonValue | undefined = document[Resources.rootField];
    const found: ClosedRoots = new ClosedRoots();
    await this.describeAsync(viewId, ClosedRootFinder.idOf(root), Resources.documentName, found, { until: Number.POSITIVE_INFINITY }, false, options);
    return found;
  }

  // A node that is the only part of one whose whole answer passed the bound is lone: its own whole answer is nearly as large, so it's
  // described one level deep straight away, sparing a call that would carry most of the page only to be refused.
  private async describeAsync(viewId: string, backendNodeId: number, name: string, found: ClosedRoots, search: SearchTime, isLone: boolean,
    options: CallOptions): Promise<void> {
    const whole: JsonObject | null = isLone ? null : await this.tryDescribeAsync(viewId, backendNodeId, Resources.wholeSubtreeDepth, options);
    if (whole !== null) {
      ClosedRootFinder.collect(whole, found);
      return;
    }
    const level: JsonObject | null = await this.tryDescribeAsync(viewId, backendNodeId, Resources.rootLevelDepth, options);
    if (level === null) {
      found.unsearched.push(name);
      return;
    }
    // The search's time starts at its first split, so the document's whole answer, refused for its size, doesn't spend it.
    if (search.until === Number.POSITIVE_INFINITY)
      search.until = Date.now() + Resources.closedRootSearchMilliseconds;
    const parts: JsonObject[] = [];
    for (const shadow of ClosedRootFinder.listOf(level[Resources.shadowRootsField]))
      if (shadow[Resources.shadowRootTypeField] === Resources.closedRootType)
        found.hosts.push(backendNodeId);
      else if (shadow[Resources.shadowRootTypeField] === Resources.openRootType)
        parts.push(shadow);
    parts.push(...ClosedRootFinder.listOf(level[Resources.childrenField]).filter(t => t[Resources.nodeTypeField] === Resources.elementNodeType));
    // Past the search's time, the parts left go unsearched, named once by their parent with how many they are.
    const isLoneElement: boolean = parts.length === 1 && parts.every(t => t[Resources.nodeTypeField] === Resources.elementNodeType);
    for (let start: number = 0; start < parts.length; start += Resources.closedRootReads) {
      if (Date.now() >= search.until) {
        found.unsearched.push(Resources.formatUnsearchedChildren(name, parts.length - start, parts.length));
        return;
      }
      await Promise.all(parts.slice(start, start + Resources.closedRootReads)
        .map(t => this.describeAsync(viewId, ClosedRootFinder.idOf(t), ClosedRootFinder.nameOf(t), found, search, isLoneElement, options)));
    }
  }

  // An element by its tag and id, which a note can name; a shadow root has neither.
  private static nameOf(node: JsonObject): string {
    if (node[Resources.nodeTypeField] !== Resources.elementNodeType)
      return Resources.shadowRootName;
    const localName: JsonValue | undefined = node[Resources.localNameField];
    const attributes: JsonValue = node[Resources.attributesField] ?? [];
    if (typeof localName !== "string" || !JsonShapes.isArray(attributes))
      throw new MalformedReplyException();
    const at: number = attributes.findIndex((t, i) => i % 2 === 0 && t === Resources.idAttribute);
    const id: JsonValue | undefined = at === -1 ? "" : attributes[at + 1];
    if (typeof id !== "string")
      throw new MalformedReplyException();
    return Resources.formatElementName(localName, id);
  }

  // The node described to the depth, through shadow roots; none when its answer passes the bound.
  private async tryDescribeAsync(viewId: string, backendNodeId: number, depth: number, options: CallOptions): Promise<JsonObject | null> {
    let reply: JsonObject;
    try {
      reply = await this.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId, depth, pierce: true },
        options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    }
    catch (error) {
      if (!(error instanceof ReplyTooLargeException))
        throw error;
      return null;
    }
    const node: JsonValue | undefined = reply[Resources.nodeField];
    if (!JsonShapes.isObject(node))
      throw new MalformedReplyException();
    return node;
  }

  // The hosts of closed roots in the node's subtree, through open roots; what a closed root holds is read with its host, and a frame's
  // document or a user agent's root holds nothing the snapshot reads.
  private static collect(node: JsonObject, found: ClosedRoots): void {
    for (const shadow of ClosedRootFinder.listOf(node[Resources.shadowRootsField]))
      if (shadow[Resources.shadowRootTypeField] === Resources.closedRootType)
        found.hosts.push(ClosedRootFinder.idOf(node));
      else if (shadow[Resources.shadowRootTypeField] === Resources.openRootType)
        ClosedRootFinder.collect(shadow, found);
    for (const child of ClosedRootFinder.listOf(node[Resources.childrenField]))
      ClosedRootFinder.collect(child, found);
  }

  private static listOf(value: JsonValue | undefined): readonly JsonObject[] {
    const list: JsonValue = value ?? [];
    if (!JsonShapes.isArray(list) || !list.every(t => JsonShapes.isObject(t)))
      throw new MalformedReplyException();
    return list.filter(t => JsonShapes.isObject(t));
  }

  private static idOf(node: JsonValue | undefined): number {
    const id: JsonValue | undefined = JsonShapes.isObject(node) ? node[Resources.backendNodeIdField] : undefined;
    if (typeof id !== "number")
      throw new MalformedReplyException();
    return id;
  }
}
