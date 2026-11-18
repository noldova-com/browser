/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { ChildrenChangedException } from "../exceptions/children-changed.exception.ts";
import { ChildrenTooManyException } from "../exceptions/children-too-many.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { PageNotShowingException } from "../exceptions/page-not-showing.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import { ReplyTooLargeException } from "../exceptions/reply-too-large.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
import type { AccessibilityNode } from "../models/accessibility-node.ts";
import { AccessibilityTree } from "../models/accessibility-tree.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { LayoutMetrics } from "../models/layout-metrics.ts";
import { ListedEnd } from "../models/listed-end.ts";
import { TreeWalk } from "../models/tree-walk.ts";
import { UnreadChild } from "../models/unread-child.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { AccessibilitySnapshot } from "./accessibility-snapshot.ts";
import { JsonShapes } from "./json-shapes.ts";
import { LayoutMetricsReader } from "./layout-metrics.reader.ts";
import { ViewCalls } from "./view-calls.ts";

type TreeRead = Promise<[PromiseSettledResult<readonly AccessibilityNode[] | null>]>;

export class AccessibilityWalk {
  private readonly calls: ViewCalls;
  private readonly log: IModuleLog;

  public constructor(calls: ViewCalls, log: IModuleLog) {
    this.calls = calls;
    this.log = log;
  }

  // Reads the tree a node's children at a time, in the snapshot's own order, and stops once the lines read are sure to pass the snapshot's
  // limit, so a page whose whole tree is too large for one reply still gives its first lines.
  // The next nodes' reads go out together, a few at a time, as each call's trip to the page takes longer than the page's answer; the walk
  // still takes their answers in its own order, so the tree is the one a read at a time gives.
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
    const stop: AbortController = new AbortController();
    const reads: Map<AccessibilityNode | UnreadChild, TreeRead> = new Map();
    try {
      const isWhole: boolean = await this.readOnAsync(viewId, walk, reads, options.withSignal(AbortSignal.any([stop.signal, options.signal]), options.deadline), maximumBytes);
      return new AccessibilityTree(root, walk.nodes, isWhole, isFromView);
    }
    finally {
      stop.abort();
      await Promise.all(reads.values());
    }
  }

  // Walks the nodes still to visit, and says whether it read them all before the limit.
  private async readOnAsync(viewId: string, walk: TreeWalk, reads: Map<AccessibilityNode | UnreadChild, TreeRead>, options: CallOptions,
    maximumBytes: number): Promise<boolean> {
    for (let next: AccessibilityNode | UnreadChild | ListedEnd | undefined = walk.pending.pop(); next !== undefined; next = walk.pending.pop()) {
      if (next instanceof ListedEnd) {
        await this.checkNamedAsync(viewId, walk, next, next.childIds.length, options);
        continue;
      }
      this.readAhead(viewId, next, walk, reads, options);
      const node: AccessibilityNode | null = next instanceof UnreadChild ? await this.adoptAsync(viewId, walk, next, await this.takeAsync(viewId, next, reads, options), options)
        : next;
      if (node === null)
        continue;
      if (!walk.count(node, maximumBytes))
        return false;
      if (node.childIds.length === 0)
        continue;
      const children: readonly AccessibilityNode[] | null = await this.takeAsync(viewId, node, reads, options);
      if (children === null) {
        const end: ListedEnd = AccessibilityWalk.endOf(node, node.childIds);
        walk.pending.push(end, ...[...await this.listChildrenAsync(viewId, end, options)].reverse());
      }
      else
        walk.pending.push(...[...walk.take(node.childIds, children)].reverse());
    }
    return true;
  }

  // Starts the reads of the node the walk is on and the next ones it comes to, so their trips to the page overlap, with at most
  // treeReadsAhead started and not yet taken.
  private readAhead(viewId: string, next: AccessibilityNode | UnreadChild, walk: TreeWalk, reads: Map<AccessibilityNode | UnreadChild, TreeRead>,
    options: CallOptions): void {
    for (const item of [next, ...walk.pending.slice(-Resources.treeReadsAhead).reverse()]) {
      if (reads.size >= Resources.treeReadsAhead)
        return;
      if (!(item instanceof ListedEnd) && !reads.has(item) && (item instanceof UnreadChild || item.childIds.length > 0))
        this.startRead(viewId, item, reads, options);
    }
  }

  private startRead(viewId: string, item: AccessibilityNode | UnreadChild, reads: Map<AccessibilityNode | UnreadChild, TreeRead>, options: CallOptions): TreeRead {
    const read: TreeRead = Promise.allSettled([item instanceof UnreadChild ? this.readElementAsync(viewId, item.backendNodeId, options) : this.readChildrenAsync(viewId, item, options)]);
    reads.set(item, read);
    return read;
  }

  // The item's read, started now when it wasn't read ahead, such as the children of a node read on its own.
  private async takeAsync(viewId: string, item: AccessibilityNode | UnreadChild, reads: Map<AccessibilityNode | UnreadChild, TreeRead>,
    options: CallOptions): Promise<readonly AccessibilityNode[] | null> {
    const [read]: [PromiseSettledResult<readonly AccessibilityNode[] | null>] = await (reads.get(item) ?? this.startRead(viewId, item, reads, options));
    reads.delete(item);
    if (read.status === "rejected")
      throw read.reason;
    return read.value;
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
      const children: readonly AccessibilityNode[] | null = await this.readChildrenAsync(viewId, parent, options);
      if (children === null) {
        walk.adopt(parent, child);
        const end: ListedEnd = AccessibilityWalk.endOf(parent, later);
        walk.pending.push(end, ...[...AccessibilityWalk.after(child, await this.listChildrenAsync(viewId, end, options))].reverse());
      }
      else
        walk.pending.push(...walk.take(later, children).filter(t => t.id !== child.id).reverse());
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
  // them out, as a whole tree read a moment later would. None when the children are too many for one answer, which the engine can't give
  // a part at a time.
  private async readChildrenAsync(viewId: string, node: AccessibilityNode, options: CallOptions): Promise<readonly AccessibilityNode[] | null> {
    try {
      return AccessibilitySnapshot.readChildren(await this.calls.sendAsync(viewId, Resources.getChildAXNodesMethod, { id: node.id }, options));
    }
    catch (error) {
      if (error instanceof ReplyTooLargeException)
        return null;
      if (!(error instanceof ProtocolFailedException))
        throw error;
      return [];
    }
  }

  // Where the children of a node with too many to read at once end, from the one named first here; a node without an element fails as too
  // large, naming the node by its role.
  private static endOf(node: AccessibilityNode, childIds: readonly string[]): ListedEnd {
    if (node.backendNodeId === null)
      throw new ChildrenTooManyException(node.role, node.childIds.length);
    return new ListedEnd(node, node.backendNodeId, childIds);
  }

  // The children of a node with too many to read at once, as its element's children, each read on its own as the walk comes near it, so
  // the walk reads only a few more of them than the snapshot shows. Its ::before and ::after are children of the node too, which the element
  // lists apart from the others: they come first and last. An element whose children alone are too many for one answer fails as
  // too large, naming the node by its role.
  private async listChildrenAsync(viewId: string, end: ListedEnd, options: CallOptions): Promise<readonly UnreadChild[]> {
    let reply: JsonObject;
    try {
      reply = await this.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId: end.backendNodeId, depth: 1 }, options);
    }
    catch (error) {
      if (!(error instanceof ReplyTooLargeException))
        throw error;
      throw new ChildrenTooManyException(end.parent.role, end.parent.childIds.length, error);
    }
    const element: JsonValue | undefined = reply[Resources.nodeField];
    if (!JsonShapes.isObject(element))
      throw new MalformedReplyException();
    const children: JsonValue = element[Resources.childrenField] ?? [];
    const pseudos: JsonValue = element[Resources.pseudoElementsField] ?? [];
    if (!JsonShapes.isArray(children) || !JsonShapes.isArray(pseudos))
      throw new MalformedReplyException();
    const after: readonly JsonValue[] = pseudos.filter(t => JsonShapes.isObject(t) && t[Resources.pseudoTypeField] === Resources.afterPseudoType);
    return [...pseudos.filter(t => !after.includes(t)), ...children, ...after].map(child => {
      const backendNodeId: JsonValue | undefined = JsonShapes.isObject(child) ? child[Resources.backendNodeIdField] : undefined;
      if (typeof backendNodeId !== "number")
        throw new MalformedReplyException();
      return new UnreadChild(backendNodeId, end);
    });
  }

  // The nodes read for an element on its own, such as a child known only by its element; none for one the page removed.
  private async readElementAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<readonly AccessibilityNode[] | null> {
    try {
      return AccessibilitySnapshot.readChildren(await this.calls.sendAsync(viewId, Resources.getPartialAXTreeMethod,
        { backendNodeId, fetchRelatives: false }, options));
    }
    catch (error) {
      if (!(error instanceof ProtocolFailedException))
        throw error;
      return null;
    }
  }

  // The child's node, when its parent names it and the walk hasn't read it; none for an element without a node of its own, such as text
  // that is only space, or one the page removed. The children named before it must be read or gone first, so a cut snapshot has no hole.
  private async adoptAsync(viewId: string, walk: TreeWalk, child: UnreadChild, nodes: readonly AccessibilityNode[] | null, options: CallOptions)
    : Promise<AccessibilityNode | null> {
    const node: AccessibilityNode | undefined = nodes?.find(t => t.backendNodeId === child.backendNodeId);
    if (node === undefined)
      return null;
    const index: number = child.end.childIds.indexOf(node.id);
    if (index > 0)
      await this.checkNamedAsync(viewId, walk, child.end, index, options);
    return walk.adopt(child.end.parent, node) ? node : null;
  }

  // The named children up to this one that the walk hasn't read are ones the page removed since the node was read, or ones its element
  // doesn't list, such as rows in a shadow root or children it takes by aria-owns. The node is read again: the ones it no longer names are
  // left out. Any it still names fail the snapshot: as changed when the node's children changed meanwhile, so a new snapshot may read them,
  // and otherwise as too large, as the walk can't read them a part at a time.
  private async checkNamedAsync(viewId: string, walk: TreeWalk, end: ListedEnd, upTo: number, options: CallOptions): Promise<void> {
    const unread: readonly string[] = walk.unread(end.childIds.slice(end.checked, upTo));
    end.checked = Math.max(end.checked, upTo);
    if (unread.length === 0)
      return;
    const named: readonly string[] = (await this.readElementAsync(viewId, end.backendNodeId, options))?.find(t => t.id === end.parent.id)?.childIds ?? [];
    if (!unread.some(t => named.includes(t)))
      return;
    if (named.join(" ") !== end.parent.childIds.join(" "))
      throw new ChildrenChangedException();
    throw new ChildrenTooManyException(end.parent.role, end.parent.childIds.length);
  }

  // The listed children after the walk's own child, by its element, or all of them when its element isn't one of them.
  private static after(child: AccessibilityNode, listed: readonly UnreadChild[]): readonly UnreadChild[] {
    return listed.slice(listed.findIndex(t => t.backendNodeId === child.backendNodeId) + 1);
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
