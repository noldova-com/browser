/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
import type { AccessibilityNode } from "../models/accessibility-node.ts";
import { AccessibilityTree } from "../models/accessibility-tree.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { Resources } from "../resources.ts";
import { AccessibilitySnapshot } from "./accessibility-snapshot.ts";
import { ViewCalls } from "./view-calls.ts";

export class AccessibilityWalk {
  private readonly calls: ViewCalls;
  private readonly log: IModuleLog;

  public constructor(calls: ViewCalls, log: IModuleLog) {
    this.calls = calls;
    this.log = log;
  }

  // Reads the tree a node's children at a time, in the snapshot's own order, and stops once the lines read are sure to pass the snapshot's
  // limit, so a page whose whole tree is too large for one reply still gives its first lines.
  public async readAsync(viewId: string, options: CallOptions, maximumBytes: number): Promise<AccessibilityTree> {
    await this.calls.sendAsync(viewId, Resources.accessibilityEnableMethod, {}, options);
    try {
      return await this.walkAsync(viewId, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes), maximumBytes);
    }
    finally {
      await this.disableAsync(viewId, options);
    }
  }

  private async walkAsync(viewId: string, options: CallOptions, maximumBytes: number): Promise<AccessibilityTree> {
    const root: AccessibilityNode = AccessibilitySnapshot.readRoot(await this.calls.sendAsync(viewId, Resources.getRootAXNodeMethod, {}, options));
    const nodes: AccessibilityNode[] = [];
    const seen: Set<string> = new Set([root.id]);
    const pending: AccessibilityNode[] = [root];
    let bytes: number = 0;
    for (let node: AccessibilityNode | undefined = pending.pop(); node !== undefined; node = pending.pop()) {
      bytes += AccessibilitySnapshot.leastLineBytes(node);
      if (bytes > maximumBytes)
        return new AccessibilityTree(root, nodes, false);
      if (node.childIds.length === 0)
        continue;
      const children: readonly AccessibilityNode[] = await this.readChildrenAsync(viewId, node, options);
      const byId: ReadonlyMap<string, AccessibilityNode> = new Map(children.map(t => [t.id, t]));
      const ordered: AccessibilityNode[] = [];
      for (const id of node.childIds) {
        const child: AccessibilityNode | undefined = byId.get(id);
        if (child !== undefined && !seen.has(id)) {
          seen.add(id);
          ordered.push(child);
        }
      }
      nodes.push(...ordered);
      pending.push(...ordered.reverse());
    }
    return new AccessibilityTree(root, nodes);
  }

  // A node the page removed after its parent was read has no children to give, and the engine answers its id as invalid: the snapshot leaves
  // them out, as a whole tree read a moment later would.
  private async readChildrenAsync(viewId: string, node: AccessibilityNode, options: CallOptions): Promise<readonly AccessibilityNode[]> {
    try {
      return AccessibilitySnapshot.readChildren(await this.calls.sendAsync(viewId, Resources.getChildAXNodesMethod, { id: node.id }, options));
    }
    catch (error) {
      if (!(error instanceof ProtocolFailedException))
        throw error;
      return [];
    }
  }

  private async disableAsync(viewId: string, options: CallOptions): Promise<void> {
    try {
      await this.calls.sendAsync(viewId, Resources.accessibilityDisableMethod, {}, ViewCalls.releasing(options));
    }
    catch (error) {
      if (!(error instanceof CallFailureException))
        throw error;
      if (!(error instanceof ViewClosedException || error instanceof PageCrashedException || error instanceof ProfileClearedException))
        this.log.write(Resources.formatAccessibilityNotDisabled(viewId, String(error)));
    }
  }
}
