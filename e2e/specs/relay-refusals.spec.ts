/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import type { JsonObject } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer, FixtureServers } from "../fixtures/fixture-servers.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

interface IDoubleView {
  readonly server: FixtureServer;
  readonly view: number;
}

interface IRefusedCall {
  readonly title: string;
  readonly method: string;
  readonly params?: JsonObject;
}

const PAGE_TITLE = "Relay page";
const RELEASED_TITLE = "Released";
const ANSWERED = "Answered";
const NOT_ALLOWED = "NotAllowed";
const NOT_OWNED = "NotOwned";
const TIMED_OUT = "TimedOut";
const TOO_LARGE = "TooLarge";
const CALL_LIMIT = 5000;
const FREE_PAGE_LIMIT = 1000;
const RELAY_REPLY_LIMIT = 4 * 1024 * 1024;
const CONTROL_METHOD = "Page.getLayoutMetrics";
const WHOLE_DOCUMENT: JsonObject = { depth: -1, pierce: true };
const PAGE_STATE = "JSON.stringify([location.href, document.documentElement.outerHTML, window.relayMarker])";
const EVERY_OTHER_METHOD = "every other method";
const SECURITY_MODEL = new URL("../../documents/SECURITY-MODEL.md", import.meta.url);

const REFUSED_CALLS: readonly IRefusedCall[] = [
  ...["setLifecycleEventsEnabled", "handleJavaScriptDialog", "stopLoading", "navigate", "navigateToHistoryEntry", "resetNavigationHistory", "reload", "setDocumentContent",
    "addScriptToEvaluateOnNewDocument", "setBypassCSP", "setDownloadBehavior", "setInterceptFileChooserDialog", "setRPHRegistrationMode", "setSPCTransactionMode",
    "getResourceContent", "searchInResource", "captureSnapshot", "printToPDF", "startScreencast", "close", "crash", "setWebLifecycleState", "setPrerenderingAllowed", "disable"]
    .map(t => ({ title: `Page.${t}`, method: `Page.${t}` })),
  { title: "Page.createIsolatedWorld", method: "Page.createIsolatedWorld", params: { frameId: "main", worldName: "another-world", grantUniveralAccess: true } },
  ...["evaluate", "compileScript", "runScript", "awaitPromise", "getProperties", "queryObjects", "globalLexicalScopeNames", "terminateExecution", "setCustomObjectFormatterEnabled"]
    .map(t => ({ title: `Runtime.${t}`, method: `Runtime.${t}`, params: t === "evaluate" ? { expression: "document.title = \"Changed\"" } : {} })),
  { title: "Runtime.callFunctionOn", method: "Runtime.callFunctionOn", params: { functionDeclaration: "function () { document.title = \"Changed\"; }", uniqueContextId: "main", returnByValue: true, silent: true } },
  { title: "Runtime.addBinding", method: "Runtime.addBinding", params: { name: "anotherBinding", executionContextName: "noldova-browser-changes" } },
  ...["getBoxModel", "querySelector", "querySelectorAll", "setFileInputFiles", "getFileInfo", "setOuterHTML", "setAttributeValue", "setAttributesAsText", "setNodeValue", "setNodeName",
    "removeNode", "moveTo", "copyTo", "undo", "redo", "markUndoableState", "resolveNode", "getOuterHTML", "setNodeStackTracesEnabled"]
    .map(t => ({ title: `DOM.${t}`, method: `DOM.${t}` })),
  { title: "Emulation.setFocusEmulationEnabled", method: "Emulation.setFocusEmulationEnabled", params: { enabled: true } },
  { title: `Emulation, ${EVERY_OTHER_METHOD}`, method: "Emulation.setUserAgentOverride", params: { userAgent: "Another agent" } },
  ...["dispatchDragEvent", "setInterceptDrags", "setIgnoreInputEvents"].map(t => ({ title: `Input.${t}`, method: `Input.${t}` })),
  { title: `Accessibility, ${EVERY_OTHER_METHOD}`, method: "Accessibility.queryAXTree" },
  ...["disable", "clear"].map(t => ({ title: `Log.${t}`, method: `Log.${t}` })),
  { title: "Network.setRequestInterception", method: "Network.setRequestInterception", params: { patterns: [] } },
  { title: "Network.continueInterceptedRequest", method: "Network.continueInterceptedRequest", params: { interceptionId: "1" } },
  { title: "Target", method: "Target.getTargets" },
  { title: "Browser", method: "Browser.getVersion" },
  { title: "Network", method: "Network.enable" },
  { title: "Storage", method: "Storage.getCookies" },
  { title: "Fetch", method: "Fetch.enable" },
  { title: "Security", method: "Security.setIgnoreCertificateErrors", params: { ignore: true } }
];

function page(script: string = "", body: string = ""): string {
  return `<!doctype html><title>${PAGE_TITLE}</title><p id="marker">Marker</p>${body}<script>window.relayMarker = "set";${script}</script>`;
}

function namesIn(cell: string, pattern: RegExp): readonly string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map(t => t[1] ?? "").filter(t => pattern.test(t));
}

function documentedTitles(): readonly string[] {
  const text = readFileSync(SECURITY_MODEL, "utf8");
  const section = text.slice(text.indexOf("## Calls on the view"), text.indexOf("### Page changes"));
  const fixed = section.split("\n").find(t => t.startsWith("Noldova Desktop's relay refuses a fixed set")) ?? "";
  const fixedDomains = /the (.+?) domains/.exec(fixed)?.[1]?.split(/, | and /) ?? [];
  const titles = new Set<string>([...fixedDomains, ...namesIn(fixed, /^[A-Z][A-Za-z]*\.[a-z][A-Za-z]*$/)]);
  for (const row of section.split("\n").filter(t => t.startsWith("| ") && !t.startsWith("| Domain"))) {
    const [domain = "", , refused = ""] = row.split(" | ").map(t => t.replace(/^\| | \|$/g, ""));
    const names = domain.includes("every other domain")
      ? domain.replace(" and every other domain", "").split(", ")
      : [...namesIn(refused, /^[a-z][A-Za-z]*$/).map(t => `${domain}.${t}`), ...(refused.startsWith("Every other method") ? [`${domain}, ${EVERY_OTHER_METHOD}`] : [])];
    for (const name of names)
      titles.add(name);
  }
  return [...titles].sort();
}

async function sendAsync(app: TestApp, method: string, params: JsonObject = {}, timeout: number = CALL_LIMIT, view?: string): Promise<string> {
  return String(await app.requestAsync("relay-double.send", { method, params, timeout, ...(view === undefined ? {} : { view }) }));
}

async function openDoubleViewAsync(app: TestApp): Promise<number> {
  await app.requestAsync("relay-double.open", null);
  await expect.poll(async () => app.requestAsync("relay-double.views", null), { message: "The relay double's web view never opened." }).toHaveLength(1);
  const views = await app.requestAsync("relay-double.views", null);
  return Array.isArray(views) ? Number(views[0]) : 0;
}

async function openDoubleAsync(app: TestApp, servers: FixtureServers, body: string, extraOrigins: readonly string[] = [],
  prepare: (server: FixtureServer) => void = () => undefined): Promise<IDoubleView> {
  const server = await servers.startAsync("relay.localhost", { "/": body });
  prepare(server);
  const view = await openDoubleViewAsync(app);
  await app.requestAsync("relay-double.allow", { origins: [server.origin, ...extraOrigins] });
  await app.requestAsync("relay-double.navigate", { url: server.url("/") });
  await expect.poll(() => app.viewPages.listAsync(), { message: "The relay double's view never showed its page." }).toContainEqual(new ViewPage(server.url("/"), PAGE_TITLE));
  expect(await sendAsync(app, CONTROL_METHOD), `The relay didn't answer the declared ${CONTROL_METHOD}, so the double's refusals prove nothing.`).toBe(ANSWERED);
  return { server, view };
}

test.describe("relay refusals", () => {
  test("every refused call of the security model's table has a test, and each test names one", () => {
    expect(REFUSED_CALLS.map(t => t.title).sort()).toEqual(documentedTitles());
  });

  for (const call of REFUSED_CALLS)
    test(call.title, async ({ app, servers }) => {
      await openDoubleAsync(app, servers, page());
      const before = await app.viewPages.runAsync(PAGE_STATE);

      expect(await sendAsync(app, call.method, call.params), `The relay didn't refuse ${call.method}.`).toBe(NOT_ALLOWED);

      expect(await app.viewPages.runAsync(PAGE_STATE), `The page changed after the refused ${call.method}.`).toBe(before);
      expect(await sendAsync(app, CONTROL_METHOD), `The relay stopped answering after the refused ${call.method}.`).toBe(ANSWERED);
    });

  test("child target session", async ({ app, servers }) => {
    const child = await servers.startAsync("127.0.0.1", { "/": `<!doctype html><title>Child</title>` });
    await openDoubleAsync(app, servers, page("", `<iframe src="${child.url("/")}"></iframe>`), [child.origin]);
    await expect.poll(() => app.viewPages.takeFrameCommitsAsync(), { message: "The child frame never committed." }).toContain(child.url("/"));
    const target = await app.viewPages.attachChildAsync(child.url("/"));
    expect(target.url, "The attached session isn't the child frame's.").toBe(child.url("/"));
    const before = await app.viewPages.runAsync(PAGE_STATE);

    expect(await sendAsync(app, "DOM.getDocument", { ...WHOLE_DOCUMENT, sessionId: target.sessionId }), "The relay didn't refuse a call that names the child target's session.")
      .toBe(NOT_ALLOWED);

    expect(await app.viewPages.runAsync(PAGE_STATE), "The page changed after the refused call.").toBe(before);
    expect(await sendAsync(app, CONTROL_METHOD), "The relay stopped answering after the refused call.").toBe(ANSWERED);
    await app.viewPages.detachChildAsync(target.sessionId);
  });

  test("foreign view id", async ({ app, servers }) => {
    const browserPage = await servers.startAsync("allowed.localhost", { "/": page() });
    await app.allowLocalSitesAsync([browserPage.origin]);
    await app.openPageAsync(browserPage.url("/"));
    await expect.poll(() => app.viewPages.listAsync(), { message: "The browser never showed its page." }).toEqual([new ViewPage(browserPage.url("/"), PAGE_TITLE)]);
    const before = await app.viewPages.runAtAsync(browserPage.url("/"), PAGE_STATE);
    const { view } = await openDoubleAsync(app, servers, page());

    expect(await sendAsync(app, CONTROL_METHOD, {}, CALL_LIMIT, String(view - 1)), "The relay didn't refuse a call to the browser's view as another module's.").toBe(NOT_OWNED);

    expect(await app.viewPages.runAtAsync(browserPage.url("/"), PAGE_STATE), "The browser's page changed after the refused call.").toBe(before);
    expect(await sendAsync(app, CONTROL_METHOD), "The relay stopped answering the double's own view after the refused call.").toBe(ANSWERED);
  });

  test("time limit", async ({ app, servers }) => {
    const isolated = { "cross-origin-opener-policy": "same-origin", "cross-origin-embedder-policy": "require-corp" };
    const holding = "const flag = new Int32Array(new SharedArrayBuffer(4)); new Worker(\"/worker.js\").postMessage(flag.buffer);"
      + `window.holdPage = () => { setTimeout(() => { while (Atomics.load(flag, 0) === 0) {} document.title = ${JSON.stringify(RELEASED_TITLE)}; }, 0); return "holding"; };`;
    const worker = "onmessage = event => { const flag = new Int32Array(event.data); const poll = () => fetch(\"/release\", { cache: \"no-store\" })"
      + ".then(t => t.ok ? Atomics.store(flag, 0, 1) : setTimeout(poll, 50), () => setTimeout(poll, 50)); poll(); };";
    const { server } = await openDoubleAsync(app, servers, page(holding), [], t => {
      t.serve("/", page(holding), isolated);
      t.serve("/worker.js", worker, { ...isolated, "content-type": "text/javascript" });
    });
    expect(await app.viewPages.runAsync("String(crossOriginIsolated)"), "The held page didn't load cross-origin isolated.").toBe("true");
    expect(await sendAsync(app, "DOM.getDocument", WHOLE_DOCUMENT, FREE_PAGE_LIMIT), `The free page didn't answer within ${FREE_PAGE_LIMIT} ms.`).toBe(ANSWERED);

    try {
      expect(await app.viewPages.runAsync("window.holdPage()"), "The page didn't start holding its main thread.").toBe("holding");
      expect(await sendAsync(app, "DOM.getDocument", WHOLE_DOCUMENT, FREE_PAGE_LIMIT), "A call the held page couldn't answer didn't end at its time limit.").toBe(TIMED_OUT);
    }
    finally {
      server.serve("/release", "released");
    }

    await expect.poll(() => app.viewPages.listAsync(), { message: "The page never left its held main thread." }).toEqual([new ViewPage(server.url("/"), RELEASED_TITLE)]);
    expect(await sendAsync(app, CONTROL_METHOD), "The relay didn't answer once the page was released.").toBe(ANSWERED);
  });

  test("size limit", async ({ app, servers }) => {
    await openDoubleAsync(app, servers, page(`document.documentElement.setAttribute("data-filler", "x".repeat(${RELAY_REPLY_LIMIT + 1}));`));

    expect(await sendAsync(app, "DOM.getDocument", WHOLE_DOCUMENT), `A reply over ${RELAY_REPLY_LIMIT} bytes didn't end with the size failure.`).toBe(TOO_LARGE);
  });
});
