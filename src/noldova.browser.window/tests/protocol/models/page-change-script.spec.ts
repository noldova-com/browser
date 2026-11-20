/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageChangeScript } from "@noldova/browser.protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

declare global {
  var noldovaBrowserChanges: unknown;
  var noldovaBrowserChanged: unknown;
}

describe("PageChangeScript", () => {
  let hear: (isOn: unknown) => unknown;
  let payloads: unknown[];
  let reported: (() => void) | null;
  let scroller: HTMLElement;

  beforeEach(() => {
    const made: unknown = new Function(`return (${PageChangeScript.functionDeclaration});`)();
    if (typeof made !== "function")
      throw new Error("The script's declaration isn't a function.");
    hear = (isOn: unknown): unknown => made(isOn);
    payloads = [];
    reported = null;
    globalThis.noldovaBrowserChanged = (payload: unknown): void => {
      payloads.push(payload);
      reported?.();
    };
    scroller = document.createElement("div");
    scroller.style.cssText = "width: 200px; height: 100px; overflow: auto;";
    const content: HTMLElement = document.createElement("div");
    content.style.height = "1000px";
    scroller.append(content);
    document.body.append(scroller);
  });

  afterEach(async () => {
    hear(false);
    scroller.remove();
    await scriptFrameAsync();
    globalThis.noldovaBrowserChanges = undefined;
    globalThis.noldovaBrowserChanged = undefined;
  });

  function scriptFrameAsync(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }

  function reportAsync(): Promise<void> {
    return new Promise<void>(resolve => {
      reported = resolve;
    });
  }

  it("hears nothing and returns false for an argument other than true or false, or in a world without the binding", async () => {
    const answers: unknown[] = [hear(1), hear("true"), hear(null)];
    globalThis.noldovaBrowserChanged = undefined;
    answers.push(hear(true));
    scroller.dataset["changed"] = "yes";
    await scriptFrameAsync();

    expect([answers, payloads, globalThis.noldovaBrowserChanges]).toEqual([[false, false, false, false], [], undefined]);
  });

  it("reports a change to the document once a frame, with no data, however many changes the frame holds", async () => {
    const answer: unknown = hear(true);
    const reporting: Promise<void> = reportAsync();
    scroller.dataset["changed"] = "yes";
    scroller.append(document.createElement("span"));
    scroller.firstChild?.appendChild(document.createTextNode("Cart"));
    await reporting;
    await scriptFrameAsync();

    expect([answer, payloads]).toEqual([true, [""]]);
  });

  it("reports a scroll of an element in the page, which never reaches the document as a bubbling event", async () => {
    hear(true);
    const reporting: Promise<void> = reportAsync();
    scroller.scrollTop = 300;
    await reporting;

    expect([scroller.scrollTop, payloads]).toEqual([300, [""]]);
  });

  function viewport(): VisualViewport {
    if (window.visualViewport === null)
      throw new Error("The page has no visual viewport.");
    return window.visualViewport;
  }

  const EVENTS: readonly (readonly [string, () => EventTarget, string])[] = [
    ["an element's load", () => scroller, "load"],
    ["an element's ended transition", () => scroller, "transitionend"],
    ["an element's ended animation", () => scroller, "animationend"],
    ["the document's scroll", () => document, "scroll"],
    ["the window's resize", () => window, "resize"],
    ["the visual viewport's resize, as a pinch zoom makes", viewport, "resize"],
    ["the visual viewport's scroll, as a pan of a pinch zoom makes", viewport, "scroll"],
    ["the fonts' loaded fonts", () => document.fonts, "loadingdone"]
  ];

  for (const [what, target, name] of EVENTS)
    it(`reports ${what}`, async () => {
      hear(true);
      target().dispatchEvent(new Event(name));
      await scriptFrameAsync();

      expect(payloads).toEqual([""]);
    });

  it("reports nothing for an event it doesn't hear, such as a click", async () => {
    hear(true);
    scroller.dispatchEvent(new Event("click", { bubbles: true }));
    await scriptFrameAsync();

    expect(payloads).toEqual([]);
  });

  it("reports a real scroll of the document", async () => {
    const tall: HTMLElement = document.createElement("div");
    tall.style.height = "4000px";
    document.body.append(tall);
    try {
      await scriptFrameAsync();
      hear(true);
      const reporting: Promise<void> = reportAsync();
      window.scrollTo(0, 200);
      await reporting;
    }
    finally {
      hear(false);
      window.scrollTo(0, 0);
      tall.remove();
    }

    expect(payloads).toEqual([""]);
  });

  it("reports a real resize of a child frame's window, in that frame's own world", async () => {
    const frame: HTMLIFrameElement = document.createElement("iframe");
    frame.style.cssText = "width: 200px; height: 100px; border: 0;";
    document.body.append(frame);
    await scriptFrameAsync();
    await scriptFrameAsync();
    const child: Window | null = frame.contentWindow;
    if (child === null)
      throw new Error("The frame has no window.");
    const childPayloads: unknown[] = [];
    Reflect.set(child, "noldovaBrowserChanged", (payload: unknown): void => {
      childPayloads.push(payload);
    });
    const childFunction: unknown = Reflect.get(child, "Function");
    if (typeof childFunction !== "function")
      throw new Error("The frame has no Function.");
    const made: unknown = Reflect.apply(childFunction, undefined, [`return (${PageChangeScript.functionDeclaration});`]);
    const childHear: unknown = typeof made === "function" ? Reflect.apply(made, undefined, []) : null;
    if (typeof childHear !== "function")
      throw new Error("The script's declaration isn't a function.");
    const answer: unknown = Reflect.apply(childHear, undefined, [true]);
    await scriptFrameAsync();
    const before: number = childPayloads.length;
    frame.style.width = "300px";
    await scriptFrameAsync();
    await scriptFrameAsync();
    const width: number = child.innerWidth;
    Reflect.apply(childHear, undefined, [false]);
    frame.remove();

    expect([answer, width, childPayloads.slice(before)]).toEqual([true, 300, [""]]);
  });

  it("hears once however often it starts, stops on the first stop, stays stopped for another, and hears again on the next start", async () => {
    const answers: unknown[] = [hear(true), hear(true)];
    const reporting: Promise<void> = reportAsync();
    scroller.dataset["changed"] = "one";
    await reporting;
    await scriptFrameAsync();
    const heard: number = payloads.length;
    answers.push(hear(false), hear(false));
    scroller.dataset["changed"] = "two";
    await scriptFrameAsync();
    const stopped: number = payloads.length;
    answers.push(hear(true));
    const again: Promise<void> = reportAsync();
    scroller.dataset["changed"] = "three";
    await again;

    expect([answers, heard, stopped, payloads.length]).toEqual([[true, true, true, true, true], 1, 1, 2]);
  });

  it("reports nothing for a change made right before it stopped", async () => {
    hear(true);
    scroller.dataset["changed"] = "yes";
    hear(false);
    await scriptFrameAsync();

    expect(payloads).toEqual([]);
  });
});
