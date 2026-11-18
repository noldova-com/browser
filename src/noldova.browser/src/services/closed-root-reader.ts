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
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { ClosedRead } from "../models/closed-read.ts";
import { SnapshotLine } from "../models/snapshot-line.ts";
import { Resources } from "../resources.ts";
import type { JsonObject } from "../types/json-value.ts";
import { AccessibilitySnapshot } from "./accessibility-snapshot.ts";
import { NodeFactsReader } from "./node-facts.reader.ts";
import { PageSnapshotReader } from "./page-snapshot.reader.ts";
import { RiskClassifier } from "./risk-classifier.ts";
import { ViewCalls } from "./view-calls.ts";

// What a closed shadow root's host holds, which the page's own script can't reach, read from the browser's accessibility tree for that host
// alone and written as the snapshot function writes the page's lines: the same roles, lifting, options and masking, a secret field's value
// read only to be masked. The host's own line is the page's and these lines follow it, one level deeper; a part read by a reference to an
// element inside such a root starts with the element's own line. None when the page removed the element.
export class ClosedRootReader {
  private readonly calls: ViewCalls;
  private readonly log: IModuleLog;

  public constructor(calls: ViewCalls, log: IModuleLog) {
    this.calls = calls;
    this.log = log;
  }

  public async readAsync(viewId: string, host: number, isHostShown: boolean, depth: number, isInteractive: boolean, mostDepth: number | null,
    maximumBytes: number, options: CallOptions): Promise<ClosedRead | null> {
    await this.calls.sendAsync(viewId, Resources.accessibilityEnableMethod, {}, options);
    try {
      return await this.walkAsync(viewId, host, isHostShown, depth, isInteractive, mostDepth ?? Number.POSITIVE_INFINITY, maximumBytes,
        options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    }
    finally {
      await this.disableAsync(viewId, options);
    }
  }

  private async walkAsync(viewId: string, host: number, isHostShown: boolean, depth: number, isInteractive: boolean, mostDepth: number,
    maximumBytes: number, options: CallOptions): Promise<ClosedRead | null> {
    const nodes: readonly AccessibilityNode[] | null = await ClosedRootReader.readNodesAsync(
      () => this.calls.sendAsync(viewId, Resources.getPartialAXTreeMethod, { backendNodeId: host, fetchRelatives: false }, options));
    const root: AccessibilityNode | undefined = nodes?.find(t => t.backendNodeId === host);
    if (root === undefined)
      return null;
    const lines: SnapshotLine[] = [];
    let bytes: number = 0;
    let isDeeper: boolean = false;
    const pending: [AccessibilityNode, number][] = isHostShown ? [...await this.readChildrenAsync(viewId, root, options)].reverse().map(t => [t, depth + 1])
      : [[root, depth]];
    for (let visit: [AccessibilityNode, number] | undefined = pending.pop(); visit !== undefined; visit = pending.pop()) {
      if (Date.now() > options.deadline - Resources.closedRootMarginMilliseconds)
        return new ClosedRead(lines, true, isDeeper);
      const [node, at]: [AccessibilityNode, number] = visit;
      if (node.role === Resources.inlineTextBoxRole)
        continue;
      const isShown: boolean = !node.isIgnored && !(Resources.liftedRoles.has(node.role) && node.name === "");
      const isListed: boolean = isShown && (!isInteractive || Resources.actionableRoles.has(node.role) || node.role === Resources.headingRole);
      const isMasked: boolean = await this.isMaskedAsync(viewId, node, options);
      const hasChildren: boolean = node.childIds.length > 0 && node.role !== Resources.staticTextRole && !isMasked;
      let childDepth: number = at;
      if (isListed) {
        const isBoundary: boolean = at + 1 >= mostDepth && hasChildren;
        const isReferenced: boolean = node.backendNodeId !== null && (Resources.actionableRoles.has(node.role) || isBoundary);
        const line: SnapshotLine = new SnapshotLine(at, node.role, node.name, isMasked ? "" : node.value, isMasked, null, null,
          isReferenced ? node.backendNodeId : null);
        const lineBytes: number = PageSnapshotReader.lineBytes(line);
        if (bytes + lineBytes > maximumBytes)
          return new ClosedRead(lines, true, isDeeper);
        bytes += lineBytes;
        lines.push(line);
        if (isBoundary) {
          isDeeper = true;
          continue;
        }
        childDepth = at + 1;
      }
      if (hasChildren)
        pending.push(...[...await this.readChildrenAsync(viewId, node, options)].reverse().map((t): [AccessibilityNode, number] => [t, childDepth]));
    }
    return new ClosedRead(lines, false, isDeeper);
  }

  // A field's value is masked when its element is secret, or when the field has no element to tell.
  private async isMaskedAsync(viewId: string, node: AccessibilityNode, options: CallOptions): Promise<boolean> {
    if (node.value === "" || !Resources.typedRoles.has(node.role))
      return false;
    if (node.backendNodeId === null)
      return true;
    return RiskClassifier.isSecret(NodeFactsReader.readNode(
      await this.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId: node.backendNodeId }, options)));
  }

  // The node's children, in its own order; none for a node the page removed since its parent was read.
  private async readChildrenAsync(viewId: string, node: AccessibilityNode, options: CallOptions): Promise<readonly AccessibilityNode[]> {
    const children: readonly AccessibilityNode[] = await ClosedRootReader.readNodesAsync(
      () => this.calls.sendAsync(viewId, Resources.getChildAXNodesMethod, { id: node.id }, options)) ?? [];
    const byId: ReadonlyMap<string, AccessibilityNode> = new Map(children.map(t => [t.id, t]));
    return node.childIds.flatMap(t => byId.get(t) ?? []);
  }

  // The nodes the call gives; none when the page removed the node it names.
  private static async readNodesAsync(call: () => Promise<JsonObject>): Promise<readonly AccessibilityNode[] | null> {
    try {
      return AccessibilitySnapshot.readChildren(await call());
    }
    catch (error) {
      if (!(error instanceof ProtocolFailedException))
        throw error;
      return null;
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
