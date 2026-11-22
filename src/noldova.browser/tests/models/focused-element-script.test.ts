/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { FocusedElementScript } from "../../src/models/focused-element-script.ts";

// The parts of a page the function reads: each node's root, a root's active element and host, and an element's open shadow root.
class FakeRoot {
  public readonly nodeType: number;
  public readonly host: FakeNode | undefined;
  public activeElement: FakeNode | null = null;

  public constructor(nodeType: number, host: FakeNode | undefined) {
    this.nodeType = nodeType;
    this.host = host;
  }

  public add(): FakeNode {
    return new FakeNode(this);
  }
}

class FakeNode {
  public readonly root: FakeRoot | null;
  public shadowRoot: FakeRoot | null = null;

  public constructor(root: FakeRoot | null) {
    this.root = root;
  }

  public getRootNode(): FakeRoot | FakeNode {
    return this.root ?? this;
  }
}

class FakePage {
  public readonly document: FakeRoot = new FakeRoot(9, undefined);
  public readonly openHost: FakeNode = this.document.add();
  public readonly closedHost: FakeNode = this.document.add();
  public readonly open: FakeRoot = new FakeRoot(11, this.openHost);
  public readonly closed: FakeRoot = new FakeRoot(11, this.closedHost);

  public constructor() {
    this.openHost.shadowRoot = this.open;
    this.document.activeElement = this.closedHost;
  }
}

const made: unknown = new Function(`return (${FocusedElementScript.functionDeclaration});`)();

function focusedOf(field: FakeNode): unknown {
  if (!Object.isFunction(made))
    throw new Error("The declaration holds no function.");
  return made.call(field);
}

describe("FocusedElementScript", () => {
  it("is the one pinned function: it returns the element that holds the focus through open shadow roots, and reads and changes nothing else", () => {
    expect(FocusedElementScript.functionDeclaration).toBe([
      "function () {",
      "  const own = this.getRootNode();",
      "  for (let root = own; root.nodeType === 11 && root.host !== undefined; root = root.host.getRootNode())",
      "    if (root.host.getRootNode().activeElement !== root.host)",
      "      return null;",
      "  let focused = own.activeElement ?? null;",
      "  while (focused !== null && focused.shadowRoot !== null && focused.shadowRoot.activeElement !== null)",
      "    focused = focused.shadowRoot.activeElement;",
      "  return focused;",
      "}"
    ].join("\n"));
  });

  it("finds the field that holds the focus inside a closed shadow root, whose host the document shows as focused", () => {
    const page: FakePage = new FakePage();
    const field: FakeNode = page.closed.add();
    page.closed.activeElement = field;

    expect([focusedOf(field), focusedOf(page.closed.add())]).toEqual([field, field]);
  });

  it("finds none when the field's shadow root holds the focus but its host doesn't hold it in the document, or the field isn't in a document", () => {
    const page: FakePage = new FakePage();
    const field: FakeNode = page.closed.add();
    page.closed.activeElement = field;
    page.document.activeElement = page.document.add();
    const detached: FakeNode = new FakeNode(null);

    expect([focusedOf(field), focusedOf(detached)]).toEqual([null, null]);
  });

  it("finds the element that holds the focus through open shadow roots, and a closed root's host for an element in another closed root", () => {
    const page: FakePage = new FakePage();
    const inner: FakeNode = page.open.add();
    page.open.activeElement = inner;
    page.document.activeElement = page.openHost;
    const field: FakeNode = page.document.add();

    expect(focusedOf(field)).toBe(inner);
    page.document.activeElement = page.closedHost;
    page.closed.activeElement = page.closed.add();
    expect(focusedOf(field)).toBe(page.closedHost);
  });
});
