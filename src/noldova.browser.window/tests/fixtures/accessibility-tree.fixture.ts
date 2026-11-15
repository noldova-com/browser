/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";

interface IDomNode {
  readonly backendNodeId: number;
  readonly frameId?: string;
  readonly attributes?: string[];
  readonly children?: IDomNode[];
  readonly shadowRoots?: IDomNode[];
  readonly contentDocument?: IDomNode;
}

interface IAccessibilityValue {
  readonly value?: unknown;
}

interface IAccessibilityNode {
  readonly nodeId: string;
  readonly ignored: boolean;
  readonly role?: IAccessibilityValue;
  readonly name?: IAccessibilityValue;
  readonly description?: IAccessibilityValue;
  readonly value?: IAccessibilityValue;
  readonly properties?: readonly { readonly name: string; readonly value: IAccessibilityValue }[];
  readonly childIds?: readonly string[];
  readonly backendDOMNodeId?: number;
}

export class AccessibilityTreeFixture {
  private static readonly MARK: string = "data-accessibility-tree-probe";
  private static readonly SKIPPED: ReadonlySet<string> = new Set(["generic", "none", "InlineTextBox", "LineBreak"]);
  private static readonly TEXT: string = "StaticText";
  private static readonly STATES: readonly string[] = ["level", "selected", "expanded", "hasPopup", "pressed", "checked", "disabled", "invalid", "busy", "valuetext"];
  private static readonly VALUED: ReadonlySet<string> = new Set(["textbox"]);

  public static async readAsync(element: Element): Promise<string[]> {
    element.setAttribute(AccessibilityTreeFixture.MARK, "");
    try {
      const { root } = await cdp().send("DOM.getDocument", { depth: -1, pierce: true }) as { root: IDomNode };
      const found = AccessibilityTreeFixture.find(root, undefined);
      if (found === null)
        throw new Error("The element isn't in the page's document.");
      const { nodes } = await cdp().send("Accessibility.getFullAXTree", found.frameId === undefined ? {} : { frameId: found.frameId }) as { nodes: IAccessibilityNode[] };
      const byId = new Map(nodes.map(t => [t.nodeId, t]));
      const start = nodes.find(t => t.backendDOMNodeId === found.node.backendNodeId);
      if (start === undefined)
        throw new Error("The element has no node in the accessibility tree.");
      const lines: string[] = [];
      AccessibilityTreeFixture.write(start, byId, 0, [], lines);
      return lines;
    }
    finally {
      element.removeAttribute(AccessibilityTreeFixture.MARK);
    }
  }

  private static find(node: IDomNode, frameId: string | undefined): { readonly node: IDomNode; readonly frameId: string | undefined } | null {
    if (node.attributes?.includes(AccessibilityTreeFixture.MARK) === true)
      return { node, frameId };
    const inner = node.contentDocument === undefined ? null : AccessibilityTreeFixture.find(node.contentDocument, node.frameId);
    if (inner !== null)
      return inner;
    for (const child of [...node.shadowRoots ?? [], ...node.children ?? []]) {
      const found = AccessibilityTreeFixture.find(child, frameId);
      if (found !== null)
        return found;
    }
    return null;
  }

  private static write(node: IAccessibilityNode, byId: ReadonlyMap<string, IAccessibilityNode>, depth: number, above: readonly string[], lines: string[]): void {
    const role = String(node.role?.value ?? "");
    const name = String(node.name?.value ?? "");
    const isShown = !node.ignored && !AccessibilityTreeFixture.SKIPPED.has(role) && !(role === AccessibilityTreeFixture.TEXT && above.includes(name));
    if (isShown)
      lines.push(`${"  ".repeat(depth)}${AccessibilityTreeFixture.describe(node, role, name)}`);
    for (const id of node.childIds ?? []) {
      const child = byId.get(id);
      if (child !== undefined)
        AccessibilityTreeFixture.write(child, byId, isShown ? depth + 1 : depth, isShown ? [name, String(node.value?.value ?? "")] : above, lines);
    }
  }

  private static describe(node: IAccessibilityNode, role: string, name: string): string {
    const parts = [name === "" ? role : `${role} ${JSON.stringify(name)}`];
    const description = String(node.description?.value ?? "");
    if (description !== "")
      parts.push(`description=${JSON.stringify(description)}`);
    const value = String(node.value?.value ?? "");
    if (AccessibilityTreeFixture.VALUED.has(role) && value !== "")
      parts.push(`value=${JSON.stringify(value)}`);
    for (const state of AccessibilityTreeFixture.STATES) {
      const property = node.properties?.find(t => t.name === state);
      if (property === undefined)
        continue;
      const shown = property.value.value;
      if (shown === true || shown === "true")
        parts.push(state);
      else if (state === "expanded" && (shown === false || shown === "false"))
        parts.push("expanded=false");
      else if (shown !== false && shown !== "false" && shown !== undefined && shown !== "")
        parts.push(`${state}=${String(shown)}`);
    }
    return parts.join(" ");
  }
}
