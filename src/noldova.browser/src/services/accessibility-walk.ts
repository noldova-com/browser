/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { PageNotShowingException } from "../exceptions/page-not-showing.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
import type { AccessibilityNode } from "../models/accessibility-node.ts";
import { AccessibilityTree } from "../models/accessibility-tree.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { LayoutMetrics } from "../models/layout-metrics.ts";
import { TreeWalk } from "../models/tree-walk.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { AccessibilitySnapshot } from "./accessibility-snapshot.ts";
import { LayoutMetricsReader } from "./layout-metrics.reader.ts";
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
  // On a scrolled page it starts at the element near the top of the view, after only the lines that lead to it, so the snapshot shows what
  // the page is scrolled to.
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
    const start: number | null = await this.findStartAsync(viewId, options);
    const path: [readonly AccessibilityNode[], AccessibilityNode] | null = start === null ? null : await this.readPathAsync(viewId, root, start, options);
    const walk: TreeWalk = new TreeWalk(root);
    const isFromView: boolean = path !== null;
    if (path === null)
      walk.pending.push(root);
    else if (!await this.leadToAsync(viewId, path[0], path[1], walk, options, maximumBytes))
      return new AccessibilityTree(root, walk.nodes, false, isFromView);
    for (let node: AccessibilityNode | undefined = walk.pending.pop(); node !== undefined; node = walk.pending.pop()) {
      if (!walk.count(node, maximumBytes))
        return new AccessibilityTree(root, walk.nodes, false, isFromView);
      if (node.childIds.length === 0)
        continue;
      const ordered: readonly AccessibilityNode[] = walk.take(node.childIds, await this.readChildrenAsync(viewId, node, options));
      walk.pending.push(...[...ordered].reverse());
    }
    return new AccessibilityTree(root, walk.nodes, true, isFromView);
  }

  // Counts the lines from the root down to the start, and stacks each level's later children below the start, so they follow its own lines;
  // the earlier children are left out.
  private async leadToAsync(viewId: string, ancestors: readonly AccessibilityNode[], start: AccessibilityNode, walk: TreeWalk, options: CallOptions,
    maximumBytes: number): Promise<boolean> {
    for (const [index, parent] of ancestors.entries()) {
      if (!walk.count(parent, maximumBytes))
        return false;
      const child: AccessibilityNode = ancestors[index + 1] ?? start;
      const later: readonly string[] = parent.childIds.slice(parent.childIds.indexOf(child.id));
      const ordered: readonly AccessibilityNode[] = walk.take(later, await this.readChildrenAsync(viewId, parent, options));
      walk.pending.push(...ordered.filter(t => t.id !== child.id).reverse());
    }
    walk.pending.push(start);
    return true;
  }

  // The element at the view's centre, a quarter of the way down, below a header the page keeps at its top; none while the page is at its top.
  private async findStartAsync(viewId: string, options: CallOptions): Promise<number | null> {
    const view: LayoutMetrics = LayoutMetricsReader.read(await this.calls.sendAsync(viewId, Resources.getLayoutMetricsMethod, {}, options));
    if (view.pageY <= 0)
      return null;
    let hit: JsonObject;
    try {
      hit = await this.calls.sendAsync(viewId, Resources.getNodeForLocationMethod,
        { x: Math.round(view.pageX + view.width / 2), y: Math.round(view.pageY + view.height / 4), includeUserAgentShadowDOM: false }, options);
    }
    catch (error) {
      if (!(error instanceof PageNotShowingException))
        throw error;
      return null;
    }
    const backendNodeId: JsonValue | undefined = hit[Resources.backendNodeIdField];
    if (typeof backendNodeId !== "number")
      throw new MalformedReplyException();
    return backendNodeId;
  }

  // The start's node and its ancestors from the root down, each found as the node that names the one below it as a child; none when the
  // start has no node in the root's tree, such as an element in a frame.
  private async readPathAsync(viewId: string, root: AccessibilityNode, start: number, options: CallOptions)
    : Promise<[readonly AccessibilityNode[], AccessibilityNode] | null> {
    const relatives: readonly AccessibilityNode[] = AccessibilitySnapshot.readChildren(
      await this.calls.sendAsync(viewId, Resources.getPartialAXTreeMethod, { backendNodeId: start, fetchRelatives: true }, options));
    const node: AccessibilityNode | undefined = relatives.find(t => t.backendNodeId === start);
    if (node === undefined)
      return null;
    const path: AccessibilityNode[] = [node];
    for (let child: AccessibilityNode = node; child.id !== root.id;) {
      const parent: AccessibilityNode | undefined = relatives.find(t => t.childIds.includes(child.id));
      if (parent === undefined || path.includes(parent))
        return null;
      path.unshift(parent);
      child = parent;
    }
    return [path.slice(0, -1), node];
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
