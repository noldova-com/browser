/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { StaleReferenceException } from "../exceptions/stale-reference.exception.ts";
import { CutText } from "../models/cut-text.ts";
import { PageSnapshot } from "../models/page-snapshot.ts";
import { SnapshotLine } from "../models/snapshot-line.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { OutputLimits } from "./output-limits.ts";

export class PageSnapshotReader {
  // The pinned function's answer; a part whose element left the page is stale.
  public static read(reply: JsonObject): PageSnapshot {
    if (reply[Resources.staleField] === true)
      throw new StaleReferenceException();
    const title: JsonValue | undefined = reply[Resources.titleField];
    const lines: JsonValue | undefined = reply[Resources.linesField];
    const isCut: JsonValue | undefined = reply[Resources.isCutField];
    const isDeeper: JsonValue | undefined = reply[Resources.isDeeperField];
    const isFromView: JsonValue | undefined = reply[Resources.isFromViewField];
    if (typeof title !== "string" || !Array.isArray(lines) || typeof isCut !== "boolean" || typeof isDeeper !== "boolean" || typeof isFromView !== "boolean")
      throw new MalformedReplyException();
    return new PageSnapshot(title, lines.map(t => PageSnapshotReader.readLine(t)), isCut, isDeeper, isFromView);
  }

  // The lines as text, each referenced element's reference issued as its line is kept, cut at a line once the next would pass the most bytes.
  public static write(lines: readonly SnapshotLine[], issue: (index: number) => string, issueNode: (backendNodeId: number) => string, maximumBytes: number)
    : CutText {
    const kept: string[] = [];
    let bytes: number = 0;
    for (const line of lines) {
      if (bytes + PageSnapshotReader.lineBytes(line) > maximumBytes)
        return new CutText(kept.join(Resources.lineSeparator), true);
      const parts: string[] = PageSnapshotReader.partsOf(line);
      if (line.index !== null)
        parts.push(Resources.formatSnapshotReference(issue(line.index)));
      else if (line.backendNodeId !== null)
        parts.push(Resources.formatSnapshotReference(issueNode(line.backendNodeId)));
      const text: string = parts.join(Resources.snapshotPartSeparator);
      bytes += OutputLimits.byteLength(text) + 1;
      kept.push(text);
    }
    return new CutText(kept.join(Resources.lineSeparator), false);
  }

  // The most bytes the line takes in the text: a reference's id isn't known until it is issued, so it counts the most one can take.
  public static lineBytes(line: SnapshotLine): number {
    const text: number = OutputLimits.byteLength(PageSnapshotReader.partsOf(line).join(Resources.snapshotPartSeparator)) + 1;
    return text + (PageSnapshotReader.isReferenced(line) ? Resources.snapshotReferenceBytes : 0);
  }

  private static partsOf(line: SnapshotLine): string[] {
    const parts: string[] = [Resources.formatSnapshotNode(line.depth, line.role)];
    if (line.name !== "")
      parts.push(JSON.stringify(line.name));
    if (line.isMasked || line.value !== "")
      parts.push(Resources.formatSnapshotValue(line.isMasked ? Resources.maskedValue : line.value));
    return parts;
  }

  private static isReferenced(line: SnapshotLine): boolean {
    return line.index !== null || line.backendNodeId !== null;
  }

  private static readLine(value: JsonValue): SnapshotLine {
    const [depth, role, name, text, isMasked, index, host] = Array.isArray(value) ? value : [];
    if (typeof depth !== "number" || !Number.isSafeInteger(depth) || depth < 0 || typeof role !== "string" || role === "" || typeof name !== "string"
      || typeof text !== "string" || typeof isMasked !== "boolean" || !PageSnapshotReader.isNumber(index) || !PageSnapshotReader.isNumber(host))
      throw new MalformedReplyException();
    return new SnapshotLine(depth, role, name, isMasked ? "" : text, isMasked, index === -1 ? null : index, host === -1 ? null : host);
  }

  // A whole number from -1, which stands for none.
  private static isNumber(value: JsonValue | undefined): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= -1;
  }
}
