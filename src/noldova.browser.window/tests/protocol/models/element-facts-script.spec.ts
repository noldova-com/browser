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
  let root: HTMLElement;
  let title: string;

  beforeEach(() => {
    const made: unknown = new Function(`return (${ElementFactsScript.functionDeclaration});`)();
    if (typeof made !== "function")
      throw new Error("The script's declaration isn't a function.");
    read = (element: Node): unknown => made.call(element);
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

  it("gives no path, form or form name for an element outside the document, and still the page's title and base URL", () => {
    document.title = "Plans";
    const loose: HTMLElement = document.createElement("form");
    loose.innerHTML = "<button>Pay</button>";
    const button: Element | null = loose.querySelector("button");
    if (button === null)
      throw new Error("The button is missing.");

    expect(read(button)).toEqual({ path: null, form: [], formName: "", title: "Plans", baseUrl: document.baseURI });
  });

  it("reads the elements of the nearest form above the element, through a shadow root, and those that name the form, never a field's typed value", () => {
    root.innerHTML = "<form id=\"checkout\"><div id=\"host\"></div><button>Pay</button></form><input form=\"checkout\" type=\"password\" name=\"pin\">"
      + "<input form=\"elsewhere\" name=\"other\">";
    const host: Element | null = root.querySelector("#host");
    const button: Element | null = root.querySelector("button");
    if (host === null || button === null)
      throw new Error("The form is missing.");
    host.attachShadow({ mode: "open" }).innerHTML = "<input name=\"code\" value=\"preset\">";
    const typed: HTMLInputElement | null = host.shadowRoot?.querySelector("input") ?? null;
    if (typed === null)
      throw new Error("The shadow field is missing.");
    typed.value = "typed";

    expect(read(button)).toMatchObject({ form: [
      ["FORM", ["id", "checkout"]], ["DIV", ["id", "host"]], ["INPUT", ["name", "code", "value", "preset"]], ["BUTTON", []], ["INPUT", ["form", "checkout", "type", "password", "name", "pin"]]
    ] });
  });

  it("reads the form its form attribute names, wherever it is, with the elements that name it, and no form when the document holds none of that id", () => {
    root.innerHTML = "<form id=\"sign-in\"><input type=\"password\"></form><form id=\"search\"><button form=\"sign-in\">Go</button><button form=\"missing\">Lost</button></form>";
    const [named, missing]: readonly Element[] = [...root.querySelectorAll("button")];
    if (named === undefined || missing === undefined)
      throw new Error("The buttons are missing.");

    expect([read(named), read(missing)]).toMatchObject([{ form: [["FORM", ["id", "sign-in"]], ["INPUT", ["type", "password"]], ["BUTTON", ["form", "sign-in"]]] }, { form: [] }]);
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
