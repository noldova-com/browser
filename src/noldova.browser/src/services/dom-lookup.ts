/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import type { AccessibilityNode } from "../models/accessibility-node.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { AccessibilitySnapshot } from "./accessibility-snapshot.ts";
import { JsonShapes } from "./json-shapes.ts";
import type { ViewCalls } from "./view-calls.ts";

// Finds the focused element through the document for a page whose whole accessibility tree is too large for one reply, and reads only its
// own accessibility node.
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

  private static readNodeId(reply: JsonObject): number {
    const nodeId: JsonValue | undefined = reply[Resources.nodeIdField];
    if (typeof nodeId !== "number")
      throw new MalformedReplyException();
    return nodeId;
  }
}
