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
import { ReplyTooLargeException } from "../exceptions/reply-too-large.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { AccessibilityTree } from "../models/accessibility-tree.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { CutText } from "../models/cut-text.ts";
import { DocumentRead } from "../models/document-read.ts";
import { ElementReference } from "../models/element-reference.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ShownPage } from "../models/shown-page.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { AccessibilitySnapshot } from "../services/accessibility-snapshot.ts";
import { AccessibilityWalk } from "../services/accessibility-walk.ts";
import { NodeFactsReader } from "../services/node-facts.reader.ts";
import { RiskClassifier } from "../services/risk-classifier.ts";
import { ToolResults } from "../services/tool-results.ts";

export class SnapshotTool implements IBrowserTool {
  private readonly kit: ToolKit;
  private readonly walk: AccessibilityWalk;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.snapshot;

  public constructor(kit: ToolKit) {
    this.kit = kit;
    this.walk = new AccessibilityWalk(kit.calls, kit.log);
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Reading, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, false);
      const { frame, tree, secrets }: DocumentRead = await this.readDocumentAsync(page.viewId, options);

      this.kit.sessions.dropReferences(page.viewId);
      const text: CutText = AccessibilitySnapshot.write(tree, secrets,
        t => this.kit.sessions.issueReference(call.session, new ElementReference(page.viewId, frame.documentId, t)), BrowserLimits.maximumSnapshotBytes);
      const title: string = AccessibilitySnapshot.readTitle(tree);
      const content: ToolContent[] = [ToolContent.fromText(Resources.formatSnapshot(frame.url, title, text.text), frame.origin)];
      if (text.isCut || !tree.isWhole)
        content.push(ToolContent.fromText(Resources.snapshotCut, null));
      return ToolResults.page(frame.origin, content, new ShownPage(frame.url, title));
    });
  }

  private async readDocumentAsync(viewId: string, options: CallOptions): Promise<DocumentRead> {
    for (let attempt: number = 1; attempt <= Resources.readAttempts; attempt++) {
      const frame: FrameFacts = await this.kit.readFrameAsync(viewId, options);
      const tree: AccessibilityTree = await this.readTreeAsync(viewId, options);
      const secrets: Set<number> = new Set();
      for (const field of AccessibilitySnapshot.typedFields(tree))
        if (RiskClassifier.isSecret(NodeFactsReader.readNode(await this.kit.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId: field }, options))))
          secrets.add(field);
      if ((await this.kit.readFrameAsync(viewId, options)).documentId === frame.documentId)
        return new DocumentRead(frame, tree, secrets);
    }
    throw new ChangedDuringReadException();
  }

  private async readTreeAsync(viewId: string, options: CallOptions): Promise<AccessibilityTree> {
    try {
      return AccessibilitySnapshot.readNodes(
        await this.kit.calls.sendAsync(viewId, Resources.getFullAXTreeMethod, {}, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes)));
    }
    catch (error) {
      if (!(error instanceof ReplyTooLargeException))
        throw error;
      return this.walk.readAsync(viewId, options, BrowserLimits.maximumSnapshotBytes);
    }
  }
}
