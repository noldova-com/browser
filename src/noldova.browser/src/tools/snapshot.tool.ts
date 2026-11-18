/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction } from "@noldova/browser.protocol";
import { type IToolDescriptor, type ToolCall, ToolContent, type ToolResult } from "@noldova/desktop.runtime";

import { ChangedDuringReadException } from "../exceptions/changed-during-read.exception.ts";
import { StaleReferenceException } from "../exceptions/stale-reference.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { ClosedRead } from "../models/closed-read.ts";
import type { ClosedRoots } from "../models/closed-roots.ts";
import type { CutText } from "../models/cut-text.ts";
import { ElementReference } from "../models/element-reference.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { MarkedSnapshot } from "../models/marked-snapshot.ts";
import { PageSnapshot } from "../models/page-snapshot.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ShownPage } from "../models/shown-page.ts";
import type { SnapshotLine } from "../models/snapshot-line.ts";
import { SnapshotReference } from "../models/snapshot-reference.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { ClosedRootFinder } from "../services/closed-root-finder.ts";
import { ClosedRootReader } from "../services/closed-root-reader.ts";
import { InputValidator } from "../services/input.validator.ts";
import { PageSnapshotReader } from "../services/page-snapshot.reader.ts";
import { ToolResults } from "../services/tool-results.ts";
import type { JsonObject } from "../types/json-value.ts";
import type { SessionReference } from "../types/session-reference.ts";

export class SnapshotTool implements IBrowserTool {
  private readonly kit: ToolKit;
  private readonly finder: ClosedRootFinder;
  private readonly reader: ClosedRootReader;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.snapshot;

  public constructor(kit: ToolKit) {
    this.kit = kit;
    this.finder = new ClosedRootFinder(kit.calls);
    this.reader = new ClosedRootReader(kit.calls, kit.log);
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const isInteractive: boolean = InputValidator.readFlag(input, Resources.interactiveField);
    const depth: number | null = input[Resources.depthField] === undefined ? null
      : InputValidator.readCount(input, Resources.depthField, Resources.mostSnapshotDepth, 1);
    const part: string | null = input[Resources.partField] === undefined ? null
      : InputValidator.readText(input, Resources.partField, BrowserLimits.maximumReferenceLength);
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Reading, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, false);
      const [frame, snapshot]: [FrameFacts, PageSnapshot] = await this.readDocumentAsync(call.session, page.viewId, isInteractive, depth, part, options);

      this.kit.sessions.dropReferences(page.viewId);
      const text: CutText = PageSnapshotReader.write(snapshot.lines,
        t => this.kit.sessions.issueReference(call.session, new SnapshotReference(page.viewId, frame.documentId, t)),
        t => this.kit.sessions.issueReference(call.session, new ElementReference(page.viewId, frame.documentId, t)), BrowserLimits.maximumSnapshotBytes);
      const content: ToolContent[] = [ToolContent.fromText(Resources.formatSnapshot(frame.url, snapshot.title, text.text), frame.origin)];
      if (snapshot.isFromView)
        content.push(ToolContent.fromText(Resources.snapshotFromView, null));
      if (depth !== null && snapshot.isDeeper)
        content.push(ToolContent.fromText(Resources.formatSnapshotDeeper(depth), null));
      if (text.isCut || snapshot.isCut)
        content.push(ToolContent.fromText(Resources.snapshotCut, null));
      if (snapshot.unread > 0)
        content.push(ToolContent.fromText(Resources.formatClosedUnread(snapshot.unread), null));
      if (snapshot.unsearched.length > 0)
        content.push(ToolContent.fromText(Resources.formatClosedUnsearched(snapshot.unsearched), null));
      return ToolResults.page(frame.origin, content, new ShownPage(frame.url, snapshot.title));
    });
  }

  // The page's lines, from a document the frame names both before and after them, so their content never carries another document's
  // origin; a part names its element by the reference, which must come from that document.
  private async readDocumentAsync(session: string, viewId: string, isInteractive: boolean, depth: number | null, part: string | null,
    options: CallOptions): Promise<[FrameFacts, PageSnapshot]> {
    for (let attempt: number = 1; attempt <= Resources.readAttempts; attempt++) {
      const frame: FrameFacts = await this.kit.readFrameAsync(viewId, options);
      const reference: SessionReference | null = part === null ? null : this.kit.sessions.resolveReference(session, part, viewId, frame.documentId);
      const snapshot: PageSnapshot = reference instanceof ElementReference
        ? await this.readClosedPartAsync(viewId, frame.documentId, reference.backendNodeId, isInteractive, depth, options)
        : await this.readPageAsync(viewId, isInteractive, depth, reference === null ? null : reference.index, options);
      if ((await this.kit.readFrameAsync(viewId, options)).documentId === frame.documentId)
        return [frame, snapshot];
    }
    throw new ChangedDuringReadException();
  }

  // The page's lines from the pinned function in one call, with what each closed shadow root holds read from the accessibility tree after
  // its host's line, in the page's order, while the lines are within the most bytes and the step has time left; past those, a host keeps
  // only its own line.
  private async readPageAsync(viewId: string, isInteractive: boolean, depth: number | null, index: number | null, options: CallOptions): Promise<PageSnapshot> {
    const roots: ClosedRoots = await this.finder.findAsync(viewId, options);
    const marked: MarkedSnapshot = await this.kit.changes.snapshotAsync(viewId, SnapshotTool.request(isInteractive, depth, index), roots.hosts, options);
    const page: PageSnapshot = PageSnapshotReader.read(marked.reply);
    const lines: SnapshotLine[] = [];
    let bytes: number = 0;
    let isCut: boolean = page.isCut;
    let isDeeper: boolean = page.isDeeper;
    let unread: number = 0;
    for (const line of page.lines) {
      lines.push(line);
      bytes += PageSnapshotReader.lineBytes(line);
      const host: number | undefined = line.host === null ? undefined : marked.hosts[line.host];
      // A host past the most bytes is cut with its line, which the cut note tells.
      if (host === undefined || bytes > BrowserLimits.maximumSnapshotBytes)
        continue;
      if (Date.now() > options.deadline - Resources.closedRootMarginMilliseconds) {
        unread++;
        continue;
      }
      const read: ClosedRead | null = await this.reader.readAsync(viewId, host, true, line.depth, isInteractive, depth,
        BrowserLimits.maximumSnapshotBytes - bytes, options);
      if (read === null)
        continue;
      lines.push(...read.lines);
      bytes += read.lines.reduce((sum, t) => sum + PageSnapshotReader.lineBytes(t), 0);
      isDeeper ||= read.isDeeper;
      // A closed root cut at the most bytes or the time left cuts the snapshot there, so no later line leaves a hole before it.
      if (read.isCut) {
        isCut = true;
        break;
      }
    }
    return new PageSnapshot(page.title, lines, isCut, isDeeper, page.isFromView, unread, roots.unsearched);
  }

  // A part inside a closed shadow root, which the page can't name, read from the accessibility tree from its element down.
  private async readClosedPartAsync(viewId: string, documentId: string, backendNodeId: number, isInteractive: boolean, depth: number | null,
    options: CallOptions): Promise<PageSnapshot> {
    const read: ClosedRead | null = await this.reader.readAsync(viewId, backendNodeId, false, 0, isInteractive, depth, BrowserLimits.maximumSnapshotBytes, options);
    if (read === null)
      throw new StaleReferenceException();
    return new PageSnapshot(await this.kit.readTitleOfAsync(viewId, documentId, options), read.lines, read.isCut, read.isDeeper, false);
  }

  // What the pinned function takes: the options, the bound and the rules, which the module keeps, so the function holds none of its own.
  private static request(isInteractive: boolean, depth: number | null, part: number | null): JsonObject {
    return {
      interactive: isInteractive,
      depth,
      part,
      maximumBytes: BrowserLimits.maximumSnapshotBytes,
      referenceBytes: Resources.snapshotReferenceBytes,
      actionableRoles: [...Resources.actionableRoles],
      typedRoles: [...Resources.typedRoles],
      liftedRoles: [...Resources.liftedRoles],
      secretAutocomplete: [...Resources.secretAutocomplete],
      cardAutocompletePrefix: Resources.cardAutocompletePrefix,
      maskedValue: Resources.maskedValue
    };
  }
}
