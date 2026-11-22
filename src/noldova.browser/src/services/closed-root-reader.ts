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
import { ClosedRootVisit } from "../models/closed-root-visit.ts";
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
// read only to be masked, in its own line and in the names of the lines around it. The host's own line is the page's and these lines follow
// it, one level deeper; a part read by a reference to an element inside such a root starts with the element's own line. None when the page
// removed the element.
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

  // The node's name with each secret field's value below it masked, as the snapshot masks it in the names of the lines around the field,
  // and every field value of the elements the name is built from through `aria-labelledby`, wherever they are: the engine builds a label's,
  // a container's or a labelled element's name from the fields in it, and hides only a password's value. A walk that runs into the step's
  // margin gives the name masked whole, since a value in it may be unread.
  public async readNameAsync(viewId: string, node: AccessibilityNode, options: CallOptions): Promise<string> {
    if (node.name === "" || (node.childIds.length === 0 && node.labelledBy.length === 0))
      return node.name;
    await this.calls.sendAsync(viewId, Resources.accessibilityEnableMethod, {}, options);
    try {
      const reading: CallOptions = options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes);
      const referenced: readonly AccessibilityNode[] | null = await this.readLabelledByAsync(viewId, node, reading);
      if (Object.isNull(referenced))
        return Resources.maskedValue;
      const labelled: readonly string[] | null = await this.readValuesAsync(viewId, referenced, [], true, reading);
      if (Object.isNull(labelled))
        return Resources.maskedValue;
      const below: readonly string[] | null = await this.readValuesAsync(viewId, await this.readChildrenAsync(viewId, node, reading), [node.id], false,
        reading);
      if (Object.isNull(below))
        return Resources.maskedValue;
      return ClosedRootReader.masked(node.name, [...labelled, ...below]);
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
    if (Object.isUndefined(root))
      return null;
    const lines: SnapshotLine[] = [];
    let bytes: number = 0;
    let isDeeper: boolean = false;
    const pending: ClosedRootVisit[] = isHostShown
      ? [...await this.readChildrenAsync(viewId, root, options)].reverse().map(t => new ClosedRootVisit(t, depth + 1, []))
      : [new ClosedRootVisit(root, depth, [])];
    for (let visit: ClosedRootVisit | undefined = pending.pop(); !Object.isUndefined(visit); visit = pending.pop()) {
      if (Date.now() > options.deadline - Resources.closedRootMarginMilliseconds)
        return new ClosedRead(lines, true, isDeeper);
      const node: AccessibilityNode = visit.node;
      const at: number = visit.depth;
      const ancestors: readonly number[] = visit.ancestors;
      if (node.role === Resources.inlineTextBoxRole || node.role === Resources.menuListPopupRole)
        continue;
      const isShown: boolean = !node.isIgnored && !(Resources.liftedRoles.has(node.role) && node.name === "");
      const isListed: boolean = isShown && (!isInteractive || Resources.actionableRoles.has(node.role) || node.role === Resources.headingRole);
      const isMasked: boolean = await this.isMaskedAsync(viewId, node, options);
      const referenced: readonly AccessibilityNode[] | null = await this.readLabelledByAsync(viewId, node, options);
      const labelled: readonly string[] | null = Object.isNull(referenced) ? null : await this.readValuesAsync(viewId, referenced, [], true, options);
      if (Object.isNull(labelled))
        return new ClosedRead(lines, true, isDeeper);
      const secrets: readonly string[] = isMasked ? [node.value, ...labelled] : labelled;
      if (secrets.length > 0)
        for (const [index, line] of lines.entries())
          if (ancestors.includes(index)) {
            const masked: SnapshotLine = ClosedRootReader.masking(line, secrets);
            bytes += PageSnapshotReader.lineBytes(masked) - PageSnapshotReader.lineBytes(line);
            lines[index] = masked;
          }
      const hasChildren: boolean = node.childIds.length > 0 && node.role !== Resources.staticTextRole && !isMasked;
      let childDepth: number = at;
      let childAncestors: readonly number[] = ancestors;
      if (isListed) {
        const isBoundary: boolean = at + 1 >= mostDepth && hasChildren;
        const isReferenced: boolean = !Object.isNull(node.backendNodeId) && (Resources.actionableRoles.has(node.role) || isBoundary);
        const line: SnapshotLine = new SnapshotLine(at, node.role, ClosedRootReader.masked(node.name, secrets), isMasked ? "" : node.value, isMasked,
          null, null,
          isReferenced ? node.backendNodeId : null);
        const lineBytes: number = PageSnapshotReader.lineBytes(line);
        if (bytes + lineBytes > maximumBytes)
          return new ClosedRead(lines, true, isDeeper);
        bytes += lineBytes;
        childAncestors = [...ancestors, lines.length];
        lines.push(line);
        if (isBoundary) {
          isDeeper = true;
          continue;
        }
        childDepth = at + 1;
      }
      if (hasChildren)
        pending.push(...[...await this.readChildrenAsync(viewId, node, options)].reverse()
          .map(t => new ClosedRootVisit(t, childDepth, childAncestors)));
    }
    return new ClosedRead(lines, false, isDeeper);
  }

  // A node's value, of any role, is masked when its element is secret, or when the node has no element to tell.
  private async isMaskedAsync(viewId: string, node: AccessibilityNode, options: CallOptions): Promise<boolean> {
    if (node.value === "")
      return false;
    if (Object.isNull(node.backendNodeId))
      return true;
    return RiskClassifier.isSecret(NodeFactsReader.readNode(
      await this.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId: node.backendNodeId }, options)));
  }

  // The values of the nodes and of the nodes below them, every value or only a secret field's, skipping the nodes already seen; none once the
  // step's time is nearly over, since a value may be left unread. A page's tree has no cycle, but a reply that names a node as its own
  // descendant must not loop.
  private async readValuesAsync(viewId: string, nodes: readonly AccessibilityNode[], seenIds: readonly string[], isEveryValue: boolean,
    options: CallOptions): Promise<readonly string[] | null> {
    const values: string[] = [];
    const seen: Set<string> = new Set<string>(seenIds);
    const pending: AccessibilityNode[] = [...nodes];
    for (let below: AccessibilityNode | undefined = pending.pop(); !Object.isUndefined(below); below = pending.pop()) {
      if (Date.now() > options.deadline - Resources.closedRootMarginMilliseconds)
        return null;
      if (seen.has(below.id))
        continue;
      seen.add(below.id);
      if (isEveryValue ? below.value !== "" : await this.isMaskedAsync(viewId, below, options))
        values.push(below.value);
      pending.push(...await this.readChildrenAsync(viewId, below, options));
    }
    return values;
  }

  // The nodes of the elements the node's name is built from through `aria-labelledby`, wherever they are in the page. None when the page
  // removed one of them: the name was built while it was there, so a value from it may be in the name, unread.
  private async readLabelledByAsync(viewId: string, node: AccessibilityNode, options: CallOptions): Promise<readonly AccessibilityNode[] | null> {
    const nodes: AccessibilityNode[] = [];
    for (const element of node.labelledBy) {
      const read: readonly AccessibilityNode[] | null = await ClosedRootReader.readNodesAsync(
        () => this.calls.sendAsync(viewId, Resources.getPartialAXTreeMethod, { backendNodeId: element, fetchRelatives: false }, options));
      const found: AccessibilityNode | undefined = read?.find(t => t.backendNodeId === element);
      if (Object.isUndefined(found))
        return null;
      nodes.push(found);
    }
    return nodes;
  }

  // An ancestor's line with the secret values masked in its name, which the engine builds from the fields inside an element, such as a label
  // around a password field; a line that doesn't hold the field keeps its name whole, even where the same text appears in it.
  private static masking(line: SnapshotLine, secrets: readonly string[]): SnapshotLine {
    return new SnapshotLine(line.depth, line.role, ClosedRootReader.masked(line.name, secrets), line.value, line.isMasked, line.index, line.host,
      line.backendNodeId);
  }

  private static masked(name: string, secrets: readonly string[]): string {
    return secrets.reduce((masked, t) => masked.replaceAll(t, Resources.maskedValue), name);
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
