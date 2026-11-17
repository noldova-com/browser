/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import type { AccessibilityNode } from "../models/accessibility-node.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { AccessibilitySnapshot } from "./accessibility-snapshot.ts";
import { JsonShapes } from "./json-shapes.ts";
import { ViewCalls } from "./view-calls.ts";

// Finds single elements through the document for a page whose whole accessibility tree is too large for one reply, and reads only their
// own accessibility nodes.
export class DomLookup {
  private readonly calls: ViewCalls;

  public constructor(calls: ViewCalls) {
    this.calls = calls;
  }

  // The element the document has focused; a focus inside a shadow root or a frame shows as its host or frame element, which isn't focused.
  public async findFocusedAsync(viewId: string, options: CallOptions): Promise<AccessibilityNode | null> {
    const root: number = await this.readDocumentAsync(viewId, options);
    const nodeId: number = DomLookup.readNodeId(
      await this.calls.sendAsync(viewId, Resources.querySelectorMethod, { nodeId: root, selector: Resources.focusedSelector }, options));
    if (nodeId === 0)
      return null;
    return AccessibilitySnapshot.findFocused(await this.readNodeAsync(viewId, nodeId, options));
  }

  // Whether a shown node's name holds the text, among the first nodes the document's text search finds; a text split between elements isn't found.
  public async hasTextAsync(viewId: string, text: string, options: CallOptions): Promise<boolean> {
    await this.readDocumentAsync(viewId, options);
    const search: JsonObject = await this.calls.sendAsync(viewId, Resources.performSearchMethod, { query: text, includeUserAgentShadowDOM: false }, options);
    const searchId: JsonValue | undefined = search[Resources.searchIdField];
    const count: JsonValue | undefined = search[Resources.resultCountField];
    if (typeof searchId !== "string" || typeof count !== "number")
      throw new MalformedReplyException();
    try {
      if (count === 0)
        return false;
      const results: JsonObject = await this.calls.sendAsync(viewId, Resources.getSearchResultsMethod,
        { searchId, fromIndex: 0, toIndex: Math.min(count, Resources.maximumSearchResults) }, options);
      for (const nodeId of DomLookup.readNodeIds(results))
        if ((await this.readFoundAsync(viewId, nodeId, options)).some(t => !t.isIgnored && t.name.includes(text)))
          return true;
      return false;
    }
    finally {
      await this.calls.sendAsync(viewId, Resources.discardSearchResultsMethod, { searchId }, ViewCalls.releasing(options));
    }
  }

  private async readDocumentAsync(viewId: string, options: CallOptions): Promise<number> {
    const reply: JsonObject = await this.calls.sendAsync(viewId, Resources.getDocumentMethod, { depth: Resources.documentOnlyDepth, pierce: true }, options);
    const root: JsonValue | undefined = reply[Resources.rootField];
    if (!JsonShapes.isObject(root))
      throw new MalformedReplyException();
    return DomLookup.readNodeId(root);
  }

  private async readNodeAsync(viewId: string, nodeId: number, options: CallOptions): Promise<readonly AccessibilityNode[]> {
    return AccessibilitySnapshot.readChildren(await this.calls.sendAsync(viewId, Resources.getPartialAXTreeMethod,
      { nodeId, fetchRelatives: false }, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes)));
  }

  // A node the page removed after the search found it answers its id as invalid, and holds no text.
  private async readFoundAsync(viewId: string, nodeId: number, options: CallOptions): Promise<readonly AccessibilityNode[]> {
    try {
      return await this.readNodeAsync(viewId, nodeId, options);
    }
    catch (error) {
      if (!(error instanceof ProtocolFailedException))
        throw error;
      return [];
    }
  }

  private static readNodeId(reply: JsonObject): number {
    const nodeId: JsonValue | undefined = reply[Resources.nodeIdField];
    if (typeof nodeId !== "number")
      throw new MalformedReplyException();
    return nodeId;
  }

  private static readNodeIds(reply: JsonObject): readonly number[] {
    const nodeIds: JsonValue | undefined = reply[Resources.nodeIdsField];
    if (!JsonShapes.isArray(nodeIds))
      throw new MalformedReplyException();
    return nodeIds.map(t => {
      if (typeof t !== "number")
        throw new MalformedReplyException();
      return t;
    });
  }
}
