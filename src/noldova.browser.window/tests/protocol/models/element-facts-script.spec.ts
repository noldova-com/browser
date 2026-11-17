/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElementFactsScript } from "@noldova/browser.protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("ElementFactsScript", () => {
  let read: (element: Node) => unknown;
  let formOf: (element: Node, isForm?: unknown) => unknown;
  let root: HTMLElement;
  let title: string;

  beforeEach(() => {
    const made: unknown = new Function(`return (${ElementFactsScript.functionDeclaration});`)();
    if (typeof made !== "function")
      throw new Error("The script's declaration isn't a function.");
    read = (element: Node): unknown => made.call(element, false);
    formOf = (element: Node, isForm: unknown = true): unknown => made.call(element, isForm);
    title = document.title;
    root = document.createElement("div");
    document.body.append(root);
  });

  afterEach(() => {
    root.remove();
    document.title = title;
  });

  it("reads the element's path from the document, root first, with each element's attributes as name and value in turn", () => {
    root.innerHTML = "<form id=\"checkout\" class=\"Wide\"><button type=\"submit\">Pay</button></form>";
    const button: Element | null = root.querySelector("button");
    if (button === null)
      throw new Error("The button is missing.");

    expect(read(button)).toMatchObject({ path: [["#document", []], ["HTML", []], ["BODY", []], ["DIV", []], ["FORM", ["id", "checkout", "class", "Wide"]], ["BUTTON", ["type", "submit"]]] });
  });

  it("goes up through open and closed shadow roots to their hosts", () => {
    const outer: HTMLElement = document.createElement("section");
    root.append(outer);
    const open: ShadowRoot = outer.attachShadow({ mode: "open" });
    const inner: HTMLElement = document.createElement("span");
    open.append(inner);
    const closed: ShadowRoot = inner.attachShadow({ mode: "closed" });
    closed.innerHTML = "<a href=\"/plans\">Plans</a>";
    const link: Element | null = closed.querySelector("a");
    if (link === null)
      throw new Error("The link is missing.");

    expect(read(link)).toMatchObject({ path: [["#document", []], ["HTML", []], ["BODY", []], ["DIV", []], ["SECTION", []], ["#document-fragment", []], ["SPAN", []], ["#document-fragment", []],
      ["A", ["href", "/plans"]]] });
  });

  it("gives no path, linked elements or form name for an element outside the document, and still the page's title and base URL", () => {
    document.title = "Plans";
    const loose: HTMLElement = document.createElement("form");
    loose.innerHTML = "<button>Pay</button>";
    const button: Element | null = loose.querySelector("button");
    if (button === null)
      throw new Error("The button is missing.");

    expect(read(button)).toEqual({ path: null, linked: [], formName: "", title: "Plans", baseUrl: document.baseURI });
  });

  it("gives the element's form as the element itself: the nearest form above it, even from inside a closed shadow root, or the form its form attribute names", () => {
    root.innerHTML = "<form id=\"checkout\"><div id=\"host\"></div></form><form id=\"sign-in\"></form><button form=\"sign-in\">Go</button>"
      + "<button form=\"missing\">Lost</button><a href=\"/\">Home</a>";
    const [checkout, signIn]: readonly Element[] = [...root.querySelectorAll("form")];
    const [named, missing]: readonly Element[] = [...root.querySelectorAll("button")];
    const host: Element | null = root.querySelector("#host");
    const link: Element | null = root.querySelector("a");
    if (checkout === undefined || signIn === undefined || named === undefined || missing === undefined || host === null || link === null)
      throw new Error("The page is missing.");
    const closed: ShadowRoot = host.attachShadow({ mode: "closed" });
    closed.innerHTML = "<button>Pay</button>";
    const pay: Element | null = closed.querySelector("button");
    if (pay === null)
      throw new Error("The shadow button is missing.");

    expect(formOf(pay)).toBe(checkout);
    expect(formOf(named)).toBe(signIn);
    expect([formOf(missing), formOf(link), formOf(document.createElement("button")), formOf(pay, "yes")]).toEqual([null, null, null, null]);
  });

  it("lists the elements that name the element's form by its id, never a field's typed value", () => {
    root.innerHTML = "<form id=\"checkout\"><button>Pay</button></form><input form=\"checkout\" type=\"password\" name=\"pin\" value=\"preset\"><input form=\"elsewhere\">";
    const button: Element | null = root.querySelector("button");
    const pin: HTMLInputElement | null = root.querySelector("input");
    if (button === null || pin === null)
      throw new Error("The form is missing.");
    pin.value = "typed";

    expect(read(button)).toMatchObject({ linked: [["INPUT", ["form", "checkout", "type", "password", "name", "pin", "value", "preset"]]] });
  });

  it("reads a form's name from the elements that label it, in order, then its label, then its title, on one line, and none outside a form", () => {
    root.innerHTML = "<h2 id=\"heading\">Create your <em>Team</em>\n account</h2><p id=\"note\">today</p><form><button>Join</button></form><a href=\"/\">Home</a>";
    const form: HTMLFormElement | null = root.querySelector("form");
    const button: Element | null = root.querySelector("button");
    const link: Element | null = root.querySelector("a");
    if (form === null || button === null || link === null)
      throw new Error("The page is missing.");
    const named = (attributes: Readonly<Record<string, string>>): unknown => {
      for (const name of ["aria-labelledby", "aria-label", "title"])
        form.removeAttribute(name);
      for (const [name, value] of Object.entries(attributes))
        form.setAttribute(name, value);
      return read(button);
    };

    expect([
      named({ "aria-labelledby": " heading  note ", "aria-label": "Sign up", title: "Join" }),
      named({ "aria-labelledby": "missing", "aria-label": " Sign\nup ", title: "Join" }),
      named({ "aria-label": " ", title: "Join" }),
      named({}),
      read(link)
    ]).toMatchObject(["Create your Team account today", "Sign up", "Join", "", ""].map(formName => ({ formName })));
  });

  it("reads the page's title from its first HTML title element on one line, never an SVG title, and the document's base URL", () => {
    document.title = " Plans\n and pricing ";
    root.innerHTML = "<svg><title>Chart</title></svg><button>Go</button>";
    const button: Element | null = root.querySelector("button");
    if (button === null)
      throw new Error("The button is missing.");

    expect(read(button)).toMatchObject({ title: "Plans and pricing", baseUrl: document.baseURI });
  });
});
