/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { ElementCountScript } from "../../src/models/element-count-script.ts";

const SHOW_ELEMENT: number = 1;

interface IFakeElement {
  readonly children: readonly IFakeElement[];
  readonly shadowRoot: IFakeElement | null;
}

interface IFakeWalker {
  currentNode: IFakeElement;
  nextNode(): IFakeElement | null;
}

function element(children: readonly IFakeElement[] = [], shadowRoot: IFakeElement | null = null): IFakeElement {
  return { children, shadowRoot };
}

function elements(count: number): IFakeElement[] {
  return Array.from({ length: count }, () => element());
}

// A walker over the root's elements in document order that, as the engine's, stays out of their shadow roots.
function walkerOf(root: IFakeElement): IFakeWalker {
  const order: IFakeElement[] = [];
  const visit = (parent: IFakeElement): void => {
    for (const child of parent.children) {
      order.push(child);
      visit(child);
    }
  };
  visit(root);
  const walker: IFakeWalker = {
    currentNode: root,
    nextNode: (): IFakeElement | null => {
      const next: IFakeElement | null = order.shift() ?? null;
      if (next !== null)
        walker.currentNode = next;
      return next;
    }
  };
  return walker;
}

function countOn(page: IFakeElement, most: unknown): unknown {
  const document: object = { ...page, createTreeWalker: (root: IFakeElement, filter: number): IFakeWalker => {
    expect(filter).toBe(SHOW_ELEMENT);
    return walkerOf(root);
  } };
  const count: unknown = runInNewContext(`(${ElementCountScript.functionDeclaration})`, { document, NodeFilter: { SHOW_ELEMENT } });
  if (typeof count !== "function")
    throw new Error("The pinned text is no function.");
  return Reflect.apply(count, undefined, [most]);
}

describe("ElementCountScript", () => {
  it("holds a page with as many elements as the most, and not one with one more", () => {
    const page: IFakeElement = element([element([element(elements(2)), element()]), element()]);

    expect([countOn(page, 6), countOn(page, 5)]).toEqual([true, false]);
  });

  it("counts the elements of every open shadow root, a nested one's too", () => {
    const page: IFakeElement = element([element([], element([element([], element(elements(2)))])), element()]);

    expect([countOn(page, 5), countOn(page, 4)]).toEqual([true, false]);
  });

  it("holds any page for a most that is no number, so the snapshot reads it as before", () => {
    expect(countOn(element(elements(3)), "1")).toBe(true);
  });
});
