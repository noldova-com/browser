/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

/**
 * The name of an agent tool that the browser module registers with the base's tool registry.
 */
export declare type BrowserToolName =
  | "browser_navigate"
  | "browser_snapshot"
  | "browser_click"
  | "browser_type"
  | "browser_press_key"
  | "browser_screenshot"
  | "browser_console"
  | "browser_wait_for";

/**
 * The browser module's agent tool names.
 */
export declare class BrowserToolNames {
  /**
   * `browser_navigate`: Opens an address in the page.
   */
  public static readonly navigate: BrowserToolName;

  /**
   * `browser_snapshot`: Reads the page's accessibility tree, with a reference for each element.
   */
  public static readonly snapshot: BrowserToolName;

  /**
   * `browser_click`: Clicks an element by its reference.
   */
  public static readonly click: BrowserToolName;

  /**
   * `browser_type`: Types text into an element by its reference.
   */
  public static readonly type: BrowserToolName;

  /**
   * `browser_press_key`: Presses a key in the page.
   */
  public static readonly pressKey: BrowserToolName;

  /**
   * `browser_screenshot`: Captures the page, or an area of it.
   */
  public static readonly screenshot: BrowserToolName;

  /**
   * `browser_console`: Reads the page's console messages.
   */
  public static readonly console: BrowserToolName;

  /**
   * `browser_wait_for`: Waits until text appears in the page or leaves it.
   */
  public static readonly waitFor: BrowserToolName;

  /**
   * Every tool name, each once, in the order the module registers the tools.
   *
   * @example
   * ```ts
   * import { BrowserToolNames } from "@noldova/browser.protocol";
   *
   * const registered: number = BrowserToolNames.all.length;
   * ```
   */
  public static readonly all: readonly BrowserToolName[];

  /**
   * Tells whether a name, such as one a tool call carries, is one of the module's tool names.
   *
   * @param value The name to look up; it matches only exactly, case included.
   * @returns `true` when `value` is one of {@link BrowserToolNames.all}, which narrows it to {@link BrowserToolName}; `false` otherwise.
   * @example
   * ```ts
   * import { BrowserToolNames } from "@noldova/browser.protocol";
   *
   * BrowserToolNames.includes("browser_click");
   * BrowserToolNames.includes("Browser_Click");
   * ```
   */
  public static includes(value: string): value is BrowserToolName;
}

/**
 * The names of the events the browser module's runtime part sends its window part.
 */
export declare class BrowserEvents {
  /**
   * The event that tells every window what an agent does on a page document, from the moment its call reaches the page until the call ends.
   * It carries a {@link PageActivity} in its wire form; the last one of an activity has the state `Ended`.
   *
   * @example
   * ```ts
   * import { BrowserEvents, PageAction, PageActivity, PageActivityState, PageBox, PagePoint } from "@noldova/browser.protocol";
   *
   * const activity: PageActivity = new PageActivity("0f8fad5b-d9cb-469f-a165-70867728950e", "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", "Scout",
   *   PageAction.Clicking, PageActivityState.Acting, new PageBox(120, 340, 96, 32), new PagePoint(168, 356), null, false);
   * const event: string = BrowserEvents.pageActivity;
   * ```
   */
  public static readonly pageActivity: string;
}

/**
 * The names of the requests the browser module's window part sends its runtime part.
 */
export declare class BrowserMethods {
  /**
   * The request that allows the origin of an address the person typed in a pane, for the workspace the pane's profile key names.
   * It carries an {@link TypedAddressRequest} and is answered with a {@link TypedAddressAnswer}.
   *
   * @example
   * ```ts
   * import { BrowserMethods, TypedAddressRequest } from "@noldova/browser.protocol";
   *
   * const request: TypedAddressRequest = new TypedAddressRequest("folder-1", "https://example.com/");
   * const method: string = BrowserMethods.allowTypedAddress;
   * ```
   */
  public static readonly allowTypedAddress: string;

  /**
   * The request that lets a page's view follow a redirect of the address the person typed there, to an origin its workspace doesn't allow.
   * The runtime part judges the redirect's address as a typed one and allows its origin for that view only, without keeping it, so it never
   * joins the workspace; the view keeps it until {@link BrowserMethods.endTypedRedirects}, an agent acts on the page, or the view closes.
   * Once an agent's call ended the view's redirects, the request fails for that view until {@link BrowserMethods.endTypedRedirects}.
   * It carries an {@link TypedRedirectRequest} and is answered with a {@link TypedAddressAnswer}.
   *
   * @example
   * ```ts
   * import { BrowserMethods, TypedRedirectRequest } from "@noldova/browser.protocol";
   *
   * const request: TypedRedirectRequest = new TypedRedirectRequest("0f8fad5b-d9cb-469f-a165-70867728950e", "folder-1", "https://www.example.com/");
   * const method: string = BrowserMethods.passTypedRedirect;
   * ```
   */
  public static readonly passTypedRedirect: string;

  /**
   * The request that ends the redirects a page's view follows, once the typed load ends: the view has only its workspace's origins again,
   * and the next typed load's redirects may pass.
   * It carries an {@link PageRequest} and is answered with null.
   *
   * @example
   * ```ts
   * import { BrowserMethods, PageRequest } from "@noldova/browser.protocol";
   *
   * const request: PageRequest = new PageRequest("0f8fad5b-d9cb-469f-a165-70867728950e");
   * const method: string = BrowserMethods.endTypedRedirects;
   * ```
   */
  public static readonly endTypedRedirects: string;

  /**
   * The request that gives a page's new view its workspace's origins, as the view's `Opened` event does, and answers once the view has them,
   * so the window part sends the view to its first address only then: a page another page opened, or one the window restores.
   * It carries an {@link PageRequest} and is answered with null.
   *
   * @example
   * ```ts
   * import { BrowserMethods, PageRequest } from "@noldova/browser.protocol";
   *
   * const request: PageRequest = new PageRequest("0f8fad5b-d9cb-469f-a165-70867728950e");
   * const method: string = BrowserMethods.readyPage;
   * ```
   */
  public static readonly readyPage: string;

  /**
   * The request that keeps a page document's workspace and last address, so a page the window restores opens in its workspace again.
   * It carries an {@link PageRecord} and is answered with null.
   *
   * @example
   * ```ts
   * import { BrowserMethods, PageRecord } from "@noldova/browser.protocol";
   *
   * const record: PageRecord = new PageRecord("0f8fad5b-d9cb-469f-a165-70867728950e", "folder-1", "https://example.com/");
   * const method: string = BrowserMethods.rememberPage;
   * ```
   */
  public static readonly rememberPage: string;

  /**
   * The request that gives a page document's record. It carries an {@link PageRequest} and is answered with the
   * {@link PageRecord}, or null when the module keeps none for the instance.
   *
   * @example
   * ```ts
   * import { BrowserMethods, PageRequest } from "@noldova/browser.protocol";
   *
   * const request: PageRequest = new PageRequest("0f8fad5b-d9cb-469f-a165-70867728950e");
   * const method: string = BrowserMethods.readPage;
   * ```
   */
  public static readonly readPage: string;

  /**
   * The request that forgets a page document that closed. It carries an {@link PageRequest} and is answered with null.
   *
   * @example
   * ```ts
   * import { BrowserMethods } from "@noldova/browser.protocol";
   *
   * const method: string = BrowserMethods.forgetPage;
   * ```
   */
  public static readonly forgetPage: string;

  /**
   * The request that clears a workspace's cookies, storage and cache, and ends the pending calls of its views.
   * It carries an {@link BrowsingDataRequest} and is answered with null.
   *
   * @example
   * ```ts
   * import { BrowserMethods, BrowsingDataRequest } from "@noldova/browser.protocol";
   *
   * const request: BrowsingDataRequest = new BrowsingDataRequest("folder-1");
   * const method: string = BrowserMethods.clearBrowsingData;
   * ```
   */
  public static readonly clearBrowsingData: string;

  /**
   * The request for the name of the app the module runs in, as the app's build names it.
   * It carries nothing and is answered with the name, a string; it fails when the build's product file can't be read.
   *
   * @example
   * ```ts
   * import { BrowserMethods } from "@noldova/browser.protocol";
   *
   * const method: string = BrowserMethods.readAppName;
   * ```
   */
  public static readonly readAppName: string;

  /**
   * The request that ends the agent calls running on a page, from the person's Stop teammate or Take over in the page's bar: each fails as stopped.
   * Take over also refuses the later calls on the page of the session that last acted on it, until that session ends.
   * It carries an {@link PageStopRequest} and is answered with null.
   *
   * @example
   * ```ts
   * import { BrowserMethods, PageStopRequest } from "@noldova/browser.protocol";
   *
   * const request: PageStopRequest = new PageStopRequest("0f8fad5b-d9cb-469f-a165-70867728950e", true);
   * const method: string = BrowserMethods.stopPage;
   * ```
   */
  public static readonly stopPage: string;

  /**
   * The request that gives the activities of the agent calls running on the pages, as {@link PageActivity} values, each as its last
   * `browser.pageActivity` event said; a window reads them again after the runtime started again, since the events sent meanwhile are lost.
   * It carries null and is answered with the array.
   *
   * @example
   * ```ts
   * import { BrowserMethods } from "@noldova/browser.protocol";
   *
   * const method: string = BrowserMethods.readActivities;
   * ```
   */
  public static readonly readActivities: string;

  /**
   * The request that makes a page document the asking window's, unless another window has it, checking and holding in one step, so of
   * two windows that claim a page at once only one has it. A window has a page until it forgets it, it closes for good or its connection
   * goes. It carries an {@link PageRequest} and is answered with an {@link PageClaim}.
   *
   * @example
   * ```ts
   * import { BrowserMethods, PageRequest } from "@noldova/browser.protocol";
   *
   * const request: PageRequest = new PageRequest("0f8fad5b-d9cb-469f-a165-70867728950e");
   * const method: string = BrowserMethods.claimPage;
   * ```
   */
  public static readonly claimPage: string;

  /**
   * The request that makes the page documents a window has open, shown or not, the window's, apart from those another window has.
   * It carries an {@link OpenPagesRequest} and is answered with an {@link HeldPages}, which names the ones another window has.
   *
   * @example
   * ```ts
   * import { BrowserMethods, OpenPagesRequest } from "@noldova/browser.protocol";
   *
   * const request: OpenPagesRequest = new OpenPagesRequest(["0f8fad5b-d9cb-469f-a165-70867728950e"]);
   * const method: string = BrowserMethods.holdPages;
   * ```
   */
  public static readonly holdPages: string;

  /**
   * The request that lets go of a page document the asking window has, keeping its record, as when Noldova Desktop refuses to open a page the
   * window claimed; a page another window has stays that window's. It carries an {@link PageRequest} and is answered with null.
   *
   * @example
   * ```ts
   * import { BrowserMethods, PageRequest } from "@noldova/browser.protocol";
   *
   * const request: PageRequest = new PageRequest("0f8fad5b-d9cb-469f-a165-70867728950e");
   * const method: string = BrowserMethods.letGoPage;
   * ```
   */
  public static readonly letGoPage: string;
}

/**
 * The person's Stop teammate or Take over on a page an agent acts on.
 */
export declare class PageStopRequest {
  /**
   * The page document's instance, a UUID in lowercase.
   */
  public readonly instance: string;

  /**
   * Whether the person takes the page over, which also refuses the later calls of the session that last acted on it.
   */
  public readonly isTakingOver: boolean;

  /**
   * Creates the request.
   *
   * @param instance The page document's instance.
   * @param isTakingOver Whether the person takes the page over rather than only stopping its calls.
   *
   * @example
   * ```ts
   * import { PageStopRequest } from "@noldova/browser.protocol";
   *
   * const request: PageStopRequest = new PageStopRequest("0f8fad5b-d9cb-469f-a165-70867728950e", false);
   * ```
   */
  public constructor(instance: string, isTakingOver: boolean);

  /**
   * Reads the request from its wire form, `{ instance, isTakingOver }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, of the wrong type or not one of these two,
   * with the path of the field.
   *
   * @example
   * ```ts
   * import { PageStopRequest } from "@noldova/browser.protocol";
   *
   * const request: PageStopRequest = PageStopRequest.fromJson({ instance: "0f8fad5b-d9cb-469f-a165-70867728950e", isTakingOver: true });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageStopRequest;

  /**
   * Writes the request in its wire form.
   *
   * @returns A new JSON object with `instance` and `isTakingOver`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageStopRequest } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageStopRequest("0f8fad5b-d9cb-469f-a165-70867728950e", true).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A page document the window part opened, as the runtime part keeps it.
 */
export declare class PageRecord {
  /**
   * The instance Noldova Desktop opened the document with, a UUID in lowercase.
   */
  public readonly instance: string;

  /**
   * The profile key of the workspace the page's view browses.
   */
  public readonly profileKey: string;

  /**
   * The address the page last showed, or empty before its first.
   */
  public readonly url: string;

  /**
   * Creates the record.
   *
   * @param instance The page document's instance.
   * @param profileKey The workspace's profile key.
   * @param url The address the page last showed, or empty before its first.
   *
   * @example
   * ```ts
   * import { PageRecord } from "@noldova/browser.protocol";
   *
   * const record: PageRecord = new PageRecord("0f8fad5b-d9cb-469f-a165-70867728950e", "folder-1", "");
   * ```
   */
  public constructor(instance: string, profileKey: string, url: string);

  /**
   * Reads the record from its wire form, `{ instance, profileKey, url }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The record.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, isn't a string or isn't one of these three,
   * with the path of the field.
   *
   * @example
   * ```ts
   * import { PageRecord } from "@noldova/browser.protocol";
   *
   * const record: PageRecord = PageRecord.fromJson({ instance: "0f8fad5b-d9cb-469f-a165-70867728950e", profileKey: "folder-1", url: "https://example.com/" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageRecord;

  /**
   * Writes the record in its wire form.
   *
   * @returns A new JSON object with `instance`, `profileKey` and `url`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageRecord } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageRecord("0f8fad5b-d9cb-469f-a165-70867728950e", "folder-1", "").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Names one page document.
 */
export declare class PageRequest {
  /**
   * The instance Noldova Desktop opened the document with.
   */
  public readonly instance: string;

  /**
   * Creates the request.
   *
   * @param instance The page document's instance.
   *
   * @example
   * ```ts
   * import { PageRequest } from "@noldova/browser.protocol";
   *
   * const request: PageRequest = new PageRequest("0f8fad5b-d9cb-469f-a165-70867728950e");
   * ```
   */
  public constructor(instance: string);

  /**
   * Reads the request from its wire form, `{ instance }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when the value isn't an object, `instance` is missing or isn't a string, or it holds another
   * field, with the path of the field.
   *
   * @example
   * ```ts
   * import { PageRequest } from "@noldova/browser.protocol";
   *
   * const request: PageRequest = PageRequest.fromJson({ instance: "0f8fad5b-d9cb-469f-a165-70867728950e" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageRequest;

  /**
   * Writes the request in its wire form.
   *
   * @returns A new JSON object with `instance`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageRequest } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageRequest("0f8fad5b-d9cb-469f-a165-70867728950e").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The agent whose call last acted on a page document, as the runtime part records it.
 */
export declare class PageAgent {
  /**
   * The page document's instance.
   */
  public readonly instance: string;

  /**
   * The agent's name as the app binds it to the session, or empty when the app binds none.
   */
  public readonly agentName: string;

  /**
   * Creates the record of the agent.
   *
   * @param instance The page document's instance.
   * @param agentName The agent's name, or empty.
   *
   * @example
   * ```ts
   * import { PageAgent } from "@noldova/browser.protocol";
   *
   * const agent: PageAgent = new PageAgent("0f8fad5b-d9cb-469f-a165-70867728950e", "Scout");
   * ```
   */
  public constructor(instance: string, agentName: string);

  /**
   * Reads the record from its wire form, `{ instance, agentName }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The record of the agent.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, isn't a string or isn't one of these two,
   * with the path of the field.
   *
   * @example
   * ```ts
   * import { PageAgent } from "@noldova/browser.protocol";
   *
   * const agent: PageAgent = PageAgent.fromJson({ instance: "0f8fad5b-d9cb-469f-a165-70867728950e", agentName: "" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageAgent;

  /**
   * Writes the record in its wire form.
   *
   * @returns A new JSON object with `instance` and `agentName`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageAgent } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageAgent("0f8fad5b-d9cb-469f-a165-70867728950e", "Scout").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to a window reporting the page documents it has open.
 */
export declare class HeldPages {
  /**
   * The instances another window has, which stay that window's; the window shows no view of them until it claims them again.
   */
  public readonly refused: readonly string[];

  /**
   * The agent last on each page the window now holds, for the pages the module records one for.
   */
  public readonly agents: readonly PageAgent[];

  /**
   * Creates the answer.
   *
   * @param refused The instances another window has; the answer keeps the array it is given.
   * @param agents The agent last on each held page the module records one for; the answer keeps the array it is given.
   *
   * @example
   * ```ts
   * import { HeldPages, PageAgent } from "@noldova/browser.protocol";
   *
   * const held: HeldPages = new HeldPages(["0f8fad5b-d9cb-469f-a165-70867728950e"], [new PageAgent("5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", "Scout")]);
   * const none: HeldPages = new HeldPages([], []);
   * ```
   */
  public constructor(refused: readonly string[], agents: readonly PageAgent[]);

  /**
   * Reads the answer from its wire form, `{ refused, agents }`, where `agents` is an array of {@link PageAgent}'s wire forms.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value isn't an object, `refused` is missing or isn't an array of strings, `agents` is
   * missing or isn't an array of agents, or it holds another field, with the path of the field or the item, such as `$.agents.0.agentName`.
   *
   * @example
   * ```ts
   * import { HeldPages } from "@noldova/browser.protocol";
   *
   * const held: HeldPages = HeldPages.fromJson({ refused: [], agents: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): HeldPages;

  /**
   * Writes the answer in its wire form.
   *
   * @returns A new JSON object with `refused` and `agents`, each agent in its wire form.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { HeldPages } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new HeldPages([], []).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Names the page documents a window has open, shown or not.
 */
export declare class OpenPagesRequest {
  /**
   * The instances Noldova Desktop opened the documents with.
   */
  public readonly instances: readonly string[];

  /**
   * Creates the request.
   *
   * @param instances The instances; the request keeps the array it is given.
   *
   * @example
   * ```ts
   * import { OpenPagesRequest } from "@noldova/browser.protocol";
   *
   * const request: OpenPagesRequest = new OpenPagesRequest(["0f8fad5b-d9cb-469f-a165-70867728950e"]);
   * ```
   */
  public constructor(instances: readonly string[]);

  /**
   * Reads the request from its wire form, `{ instances }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when the value isn't an object, `instances` is missing or isn't an array of strings, or it holds
   * another field, with the path of the field or the item.
   *
   * @example
   * ```ts
   * import { OpenPagesRequest } from "@noldova/browser.protocol";
   *
   * const request: OpenPagesRequest = OpenPagesRequest.fromJson({ instances: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): OpenPagesRequest;

  /**
   * Writes the request in its wire form.
   *
   * @returns A new JSON object with `instances`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { OpenPagesRequest } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new OpenPagesRequest([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to a window claiming a page document.
 */
export declare class PageClaim {
  /**
   * Whether the page is the asking window's now; false when another window has it.
   */
  public readonly isClaimed: boolean;

  /**
   * Whether the page was already the asking window's, as one it has open, shown or not.
   */
  public readonly isHere: boolean;

  /**
   * The page's record, when the window claimed it and the module keeps one; null otherwise.
   */
  public readonly record: PageRecord | null;

  /**
   * The name of the agent whose call last acted on the page, when the window claimed it and the module keeps one; null otherwise.
   */
  public readonly agentName: string | null;

  /**
   * Creates the answer.
   *
   * @param isClaimed Whether the page is the asking window's now.
   * @param isHere Whether the page was already the asking window's.
   * @param record The page's record, or null.
   * @param agentName The agent last on the page, or null.
   *
   * @example
   * ```ts
   * import { PageClaim } from "@noldova/browser.protocol";
   *
   * const claim: PageClaim = new PageClaim(true, false, null, null);
   * ```
   */
  public constructor(isClaimed: boolean, isHere: boolean, record: PageRecord | null, agentName: string | null);

  /**
   * Reads the answer from its wire form, `{ isClaimed, isHere, record, agentName }`, where `record` is a {@link PageRecord}'s wire form
   * or null and `agentName` a string or null; none of the four may be left out.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, of the wrong type or not one of these four,
   * or the record isn't a record, with the path of the field, such as `$.record.url`.
   *
   * @example
   * ```ts
   * import { PageClaim } from "@noldova/browser.protocol";
   *
   * const claim: PageClaim = PageClaim.fromJson({ isClaimed: false, isHere: false, record: null, agentName: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageClaim;

  /**
   * Writes the answer in its wire form.
   *
   * @returns A new JSON object with `isClaimed`, `isHere`, `record`, the record's wire form or null, and `agentName`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageClaim, PageRecord } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageClaim(true, true, new PageRecord("0f8fad5b-d9cb-469f-a165-70867728950e", "folder-1", ""), "Scout").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Names the workspace whose browsing data the person clears.
 */
export declare class BrowsingDataRequest {
  /**
   * The workspace's profile key.
   */
  public readonly profileKey: string;

  /**
   * Creates the request.
   *
   * @param profileKey The workspace's profile key.
   *
   * @example
   * ```ts
   * import { BrowsingDataRequest } from "@noldova/browser.protocol";
   *
   * const request: BrowsingDataRequest = new BrowsingDataRequest("folder-1");
   * ```
   */
  public constructor(profileKey: string);

  /**
   * Reads the request from its wire form, `{ profileKey }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when the value isn't an object, `profileKey` is missing or isn't a string, or it holds another
   * field, with the path of the field.
   *
   * @example
   * ```ts
   * import { BrowsingDataRequest } from "@noldova/browser.protocol";
   *
   * const request: BrowsingDataRequest = BrowsingDataRequest.fromJson({ profileKey: "folder-1" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): BrowsingDataRequest;

  /**
   * Writes the request in its wire form.
   *
   * @returns A new JSON object with `profileKey`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { BrowsingDataRequest } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new BrowsingDataRequest("folder-1").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Why the runtime part refused to allow an address the person typed.
 *
 * @example
 * ```ts
 * import { TypedAddressAnswerKind, TypedAddressRefusal, type TypedAddressAnswer } from "@noldova/browser.protocol";
 *
 * function isLocal(answer: TypedAddressAnswer): boolean {
 *   return answer.kind === TypedAddressAnswerKind.Refused && answer.reason === TypedAddressRefusal.Local;
 * }
 * ```
 */
export declare const TypedAddressRefusal: {
  /**
   * The text isn't a web address, such as words with spaces, wire value `"NotAnAddress"`.
   */
  readonly NotAnAddress: "NotAnAddress";

  /**
   * The address's scheme is neither `http:` nor `https:`, wire value `"NotWeb"`.
   */
  readonly NotWeb: "NotWeb";

  /**
   * The address is longer than 32,768 characters, wire value `"TooLong"`.
   */
  readonly TooLong: "TooLong";

  /**
   * The address carries a user name or a password, wire value `"Credentials"`.
   */
  readonly Credentials: "Credentials";

  /**
   * The address is on this machine or its local network, and the app's settings don't name its origin, wire value `"Local"`.
   */
  readonly Local: "Local";

  /**
   * The address is one Browser never opens, such as a link-local or unspecified address, wire value `"NeverAllowed"`.
   */
  readonly NeverAllowed: "NeverAllowed";
};

/**
 * One of {@link TypedAddressRefusal}'s wire values: `"NotAnAddress"`, `"NotWeb"`, `"TooLong"`, `"Credentials"`, `"Local"` or `"NeverAllowed"`.
 */
export type TypedAddressRefusal = (typeof TypedAddressRefusal)[keyof typeof TypedAddressRefusal];

/**
 * An address the person typed in a pane, for the runtime part to allow.
 */
export declare class TypedAddressRequest {
  /**
   * The pane's profile key, which names its workspace.
   */
  public readonly profileKey: string;

  /**
   * The whole address the person typed, with its scheme.
   */
  public readonly url: string;

  /**
   * The instance of the page document the pane shows, or `null` when the pane shows none.
   * When an agent's call to that page starts while the request waits, the runtime part answers {@link TypedAddressLeft}.
   */
  public readonly instance: string | null;

  /**
   * Creates the request.
   *
   * @param profileKey The pane's profile key.
   * @param url The whole address the person typed.
   * @param instance The instance of the page document the pane shows; `null` by default.
   *
   * @example
   * ```ts
   * import { TypedAddressRequest } from "@noldova/browser.protocol";
   *
   * const request: TypedAddressRequest = new TypedAddressRequest("folder-1", "https://example.com/docs", "page-1");
   * ```
   */
  public constructor(profileKey: string, url: string, instance?: string | null);

  /**
   * Reads the request from its wire form, `{ profileKey, url, instance? }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The request, its instance `null` when the wire form has none.
   * @throws JsonException synchronously when the value isn't an object, `profileKey` or `url` is missing, a field isn't a string or
   * isn't one of these three, with the path of the field.
   *
   * @example
   * ```ts
   * import { TypedAddressRequest } from "@noldova/browser.protocol";
   *
   * const request: TypedAddressRequest = TypedAddressRequest.fromJson({ profileKey: "folder-1", url: "https://example.com/docs" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): TypedAddressRequest;

  /**
   * Writes the request in its wire form.
   *
   * @returns A new JSON object with `profileKey` and `url`, and `instance` when it isn't `null`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { TypedAddressRequest } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new TypedAddressRequest("folder-1", "https://example.com/docs").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A redirect of an address the person typed on a page, for the runtime part to let the page's view follow for that load only.
 */
export declare class TypedRedirectRequest {
  /**
   * The page document's instance, whose view follows the redirect.
   */
  public readonly instance: string;

  /**
   * The page's profile key, which names its workspace.
   */
  public readonly profileKey: string;

  /**
   * The redirect's whole address.
   */
  public readonly url: string;

  /**
   * Creates the request.
   *
   * @param instance The page document's instance.
   * @param profileKey The page's profile key.
   * @param url The redirect's whole address.
   *
   * @example
   * ```ts
   * import { TypedRedirectRequest } from "@noldova/browser.protocol";
   *
   * const request: TypedRedirectRequest = new TypedRedirectRequest("0f8fad5b-d9cb-469f-a165-70867728950e", "folder-1", "https://www.example.com/");
   * ```
   */
  public constructor(instance: string, profileKey: string, url: string);

  /**
   * Reads the request from its wire form, `{ instance, profileKey, url }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, isn't a string or isn't one of these three,
   * with the path of the field.
   *
   * @example
   * ```ts
   * import { TypedRedirectRequest } from "@noldova/browser.protocol";
   *
   * const request: TypedRedirectRequest = TypedRedirectRequest.fromJson({ instance: "0f8fad5b-d9cb-469f-a165-70867728950e", profileKey: "folder-1", url: "https://www.example.com/" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): TypedRedirectRequest;

  /**
   * Writes the request in its wire form.
   *
   * @returns A new JSON object with `instance`, `profileKey` and `url`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { TypedRedirectRequest } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new TypedRedirectRequest("0f8fad5b-d9cb-469f-a165-70867728950e", "folder-1", "https://www.example.com/").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime part allowed the typed address's origin in the workspace, and the pane may go there.
 */
export declare class TypedAddressAllowed {
  /**
   * Marks this answer in a {@link TypedAddressAnswer}, always `Allowed`.
   */
  public readonly kind: typeof TypedAddressAnswerKind.Allowed;

  /**
   * The origin now allowed, such as `https://example.com`.
   */
  public readonly origin: string;

  /**
   * Creates the answer.
   *
   * @param origin The origin now allowed.
   *
   * @example
   * ```ts
   * import { TypedAddressAllowed } from "@noldova/browser.protocol";
   *
   * const answer: TypedAddressAllowed = new TypedAddressAllowed("https://example.com");
   * ```
   */
  public constructor(origin: string);

  /**
   * Reads the answer from its wire form, `{ kind: "Allowed", origin }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value isn't an object, its kind isn't `Allowed`, `origin` is missing or isn't a string,
   * or it holds another field, with the path of the field.
   *
   * @example
   * ```ts
   * import { TypedAddressAllowed } from "@noldova/browser.protocol";
   *
   * const answer: TypedAddressAllowed = TypedAddressAllowed.fromJson({ kind: "Allowed", origin: "https://example.com" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): TypedAddressAllowed;

  /**
   * Writes the answer in its wire form.
   *
   * @returns A new JSON object with `kind` and `origin`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { TypedAddressAllowed } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new TypedAddressAllowed("https://example.com").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime part's answer to a {@link TypedAddressRequest} whose pane's page an agent's call started on while the request waited: the
 * person's address is left, and the pane goes nowhere.
 */
export declare class TypedAddressLeft {
  /**
   * Marks this answer in a {@link TypedAddressAnswer}, always `Left`.
   */
  public readonly kind: typeof TypedAddressAnswerKind.Left;

  /**
   * Creates the answer.
   *
   * @example
   * ```ts
   * import { TypedAddressLeft } from "@noldova/browser.protocol";
   *
   * const answer: TypedAddressLeft = new TypedAddressLeft();
   * ```
   */
  public constructor();

  /**
   * Reads the answer from its wire form, `{ kind: "Left" }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value isn't an object, its kind is missing or isn't `Left`, or it holds another field,
   * with the path of the field.
   *
   * @example
   * ```ts
   * import { TypedAddressLeft } from "@noldova/browser.protocol";
   *
   * const answer: TypedAddressLeft = TypedAddressLeft.fromJson({ kind: "Left" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): TypedAddressLeft;

  /**
   * Writes the answer in its wire form.
   *
   * @returns A new JSON object with `kind`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { TypedAddressLeft } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new TypedAddressLeft().toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime part refused the typed address, allowed nothing, and the pane doesn't go there.
 */
export declare class TypedAddressRefused {
  /**
   * Marks this answer in a {@link TypedAddressAnswer}, always `Refused`.
   */
  public readonly kind: typeof TypedAddressAnswerKind.Refused;

  /**
   * Why the address was refused.
   */
  public readonly reason: TypedAddressRefusal;

  /**
   * Creates the answer.
   *
   * @param reason Why the address was refused.
   *
   * @example
   * ```ts
   * import { TypedAddressRefusal, TypedAddressRefused } from "@noldova/browser.protocol";
   *
   * const answer: TypedAddressRefused = new TypedAddressRefused(TypedAddressRefusal.Local);
   * ```
   */
  public constructor(reason: TypedAddressRefusal);

  /**
   * Reads the answer from its wire form, `{ kind: "Refused", reason }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value isn't an object, its kind isn't `Refused`, `reason` is missing or isn't one of
   * {@link TypedAddressRefusal}'s values, or it holds another field, with the path of the field.
   *
   * @example
   * ```ts
   * import { TypedAddressRefused } from "@noldova/browser.protocol";
   *
   * const answer: TypedAddressRefused = TypedAddressRefused.fromJson({ kind: "Refused", reason: "NotWeb" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): TypedAddressRefused;

  /**
   * Writes the answer in its wire form.
   *
   * @returns A new JSON object with `kind` and `reason`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { TypedAddressRefusal, TypedAddressRefused } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new TypedAddressRefused(TypedAddressRefusal.TooLong).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Which answer the runtime part gave to an {@link TypedAddressRequest}, which marks a {@link TypedAddressAnswer}.
 *
 * @example
 * ```ts
 * import { TypedAddressAnswerKind, type TypedAddressAnswer } from "@noldova/browser.protocol";
 *
 * function describe(answer: TypedAddressAnswer): string {
 *   if (answer.kind === TypedAddressAnswerKind.Allowed)
 *     return answer.origin;
 *   return answer.kind === TypedAddressAnswerKind.Refused ? answer.reason : "left";
 * }
 * ```
 */
export declare const TypedAddressAnswerKind: {
  /**
   * The origin is allowed: an {@link TypedAddressAllowed}, wire value `"Allowed"`.
   */
  readonly Allowed: "Allowed";

  /**
   * The address is refused: an {@link TypedAddressRefused}, wire value `"Refused"`.
   */
  readonly Refused: "Refused";

  /**
   * An agent's call to the pane's page started while the request waited, so the person's address is left: an {@link TypedAddressLeft},
   * wire value `"Left"`.
   */
  readonly Left: "Left";
};

/**
 * One of {@link TypedAddressAnswerKind}'s wire values: `"Allowed"`, `"Refused"` or `"Left"`.
 */
export type TypedAddressAnswerKind = (typeof TypedAddressAnswerKind)[keyof typeof TypedAddressAnswerKind];

/**
 * The runtime part's answer to a {@link TypedAddressRequest}: allowed with the origin, refused with the reason, or left to an agent's call.
 *
 * @example
 * ```ts
 * import { TypedAddressAnswerKind, type TypedAddressAnswer } from "@noldova/browser.protocol";
 *
 * function describe(answer: TypedAddressAnswer): string {
 *   if (answer.kind === TypedAddressAnswerKind.Allowed)
 *     return answer.origin;
 *   return answer.kind === TypedAddressAnswerKind.Refused ? answer.reason : "left";
 * }
 * ```
 */
export declare type TypedAddressAnswer = TypedAddressAllowed | TypedAddressRefused | TypedAddressLeft;

/**
 * Reads a {@link TypedAddressAnswer} from its wire form, by its kind.
 */
export declare class TypedAddressAnswerReader {
  /**
   * Reads the answer, a {@link TypedAddressAllowed} for the kind `Allowed`, a {@link TypedAddressRefused} for `Refused` and a
   * {@link TypedAddressLeft} for `Left`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer of its kind.
   * @throws JsonException synchronously when the value isn't an object, its kind is missing or none of `Allowed`, `Refused` and `Left`,
   * or it isn't an answer of that kind, with the path of the field.
   *
   * @example
   * ```ts
   * import { TypedAddressAnswerReader, type TypedAddressAnswer } from "@noldova/browser.protocol";
   *
   * const answer: TypedAddressAnswer = TypedAddressAnswerReader.read({ kind: "Refused", reason: "Local" });
   * ```
   */
  public static read(value: unknown, path?: string): TypedAddressAnswer;
}

/**
 * What an agent does on a page.
 *
 * @example
 * ```ts
 * import { PageAction, type PageActivity } from "@noldova/browser.protocol";
 *
 * function isAiming(activity: PageActivity): boolean {
 *   return activity.action === PageAction.Clicking || activity.action === PageAction.Typing;
 * }
 * ```
 */
export declare const PageAction: {
  /**
   * It moves the page to an address, or back, forward or reload, wire value `"Navigating"`.
   */
  readonly Navigating: "Navigating";

  /**
   * It reads the page, wire value `"Reading"`.
   */
  readonly Reading: "Reading";

  /**
   * It clicks an element, wire value `"Clicking"`.
   */
  readonly Clicking: "Clicking";

  /**
   * It types into an element, wire value `"Typing"`.
   */
  readonly Typing: "Typing";

  /**
   * It presses a key, wire value `"PressingKey"`.
   */
  readonly PressingKey: "PressingKey";

  /**
   * It waits for something on the page, wire value `"Waiting"`.
   */
  readonly Waiting: "Waiting";
};

/**
 * One of {@link PageAction}'s wire values: `"Navigating"`, `"Reading"`, `"Clicking"`, `"Typing"`, `"PressingKey"` or `"Waiting"`.
 */
export type PageAction = (typeof PageAction)[keyof typeof PageAction];

/**
 * Where an agent's control of a page stands.
 *
 * @example
 * ```ts
 * import { PageActivityState, type PageActivity } from "@noldova/browser.protocol";
 *
 * function isOver(activity: PageActivity): boolean {
 *   return activity.state === PageActivityState.Ended;
 * }
 * ```
 */
export declare const PageActivityState: {
  /**
   * One of the agent's calls works on the page, wire value `"Acting"`.
   */
  readonly Acting: "Acting";

  /**
   * One of the agent's calls waits for the person to answer its permission request, wire value `"Asking"`.
   */
  readonly Asking: "Asking";

  /**
   * The agent controls the page, and none of its calls runs, wire value `"Idle"`.
   */
  readonly Idle: "Idle";

  /**
   * The agent's control is over: it closed the page, the person took over or stopped it, or its session ended, wire value `"Ended"`.
   */
  readonly Ended: "Ended";
};

/**
 * One of {@link PageActivityState}'s wire values: `"Acting"`, `"Asking"`, `"Idle"` or `"Ended"`.
 */
export type PageActivityState = (typeof PageActivityState)[keyof typeof PageActivityState];

/**
 * A rectangle in a page's viewport, in CSS pixels from its top left corner.
 */
export declare class PageBox {
  /**
   * The left edge, a finite number.
   */
  public readonly x: number;

  /**
   * The top edge, a finite number.
   */
  public readonly y: number;

  /**
   * The width, a finite number of zero or more.
   */
  public readonly width: number;

  /**
   * The height, a finite number of zero or more.
   */
  public readonly height: number;

  /**
   * Creates the box.
   *
   * @param x The left edge, any finite number.
   * @param y The top edge, any finite number.
   * @param width The width, finite and zero or more.
   * @param height The height, finite and zero or more.
   * @throws ArgumentException synchronously when an edge isn't finite, or the width or the height isn't finite or is below zero,
   * naming the parameter.
   *
   * @example
   * ```ts
   * import { PageBox } from "@noldova/browser.protocol";
   *
   * const box: PageBox = new PageBox(120, 340, 96, 32);
   * const line: PageBox = new PageBox(-8, 0, 0, 12);
   * ```
   */
  public constructor(x: number, y: number, width: number, height: number);

  /**
   * Reads the box from its wire form, `{ x, y, width, height }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The box.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, isn't a number or isn't one of these four,
   * or the width or the height is below zero, with the path of the field, such as `$.box.width`.
   *
   * @example
   * ```ts
   * import { PageBox } from "@noldova/browser.protocol";
   *
   * const box: PageBox = PageBox.fromJson({ x: 120, y: 340, width: 96, height: 32 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageBox;

  /**
   * Tells whether another box has the same edges and size.
   *
   * @param box The other box.
   * @returns True when its `x`, `y`, `width` and `height` all equal this box's.
   *
   * @example
   * ```ts
   * import { PageBox } from "@noldova/browser.protocol";
   *
   * const isSame: boolean = new PageBox(1, 2, 3, 4).isSame(new PageBox(1, 2, 3, 5));
   * ```
   */
  public isSame(box: PageBox): boolean;

  /**
   * Writes the box in its wire form.
   *
   * @returns A new JSON object with `x`, `y`, `width` and `height`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageBox } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageBox(120, 340, 96, 32).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A point in a page's viewport, in CSS pixels from its top left corner.
 */
export declare class PagePoint {
  /**
   * The distance from the left edge, a finite number.
   */
  public readonly x: number;

  /**
   * The distance from the top edge, a finite number.
   */
  public readonly y: number;

  /**
   * Creates the point.
   *
   * @param x The distance from the left edge, any finite number.
   * @param y The distance from the top edge, any finite number.
   * @throws ArgumentException synchronously when a coordinate isn't finite, naming the parameter.
   *
   * @example
   * ```ts
   * import { PagePoint } from "@noldova/browser.protocol";
   *
   * const point: PagePoint = new PagePoint(168, 356);
   * ```
   */
  public constructor(x: number, y: number);

  /**
   * Reads the point from its wire form, `{ x, y }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The point.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, isn't a number or isn't one of these two,
   * with the path of the field.
   *
   * @example
   * ```ts
   * import { PagePoint } from "@noldova/browser.protocol";
   *
   * const point: PagePoint = PagePoint.fromJson({ x: 168, y: 356 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PagePoint;

  /**
   * Writes the point in its wire form.
   *
   * @returns A new JSON object with `x` and `y`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PagePoint } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PagePoint(168, 356).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An agent's control of a page document, from its first call on the page until it closes the page, the person takes over or stops it, or its session ends,
 * as the runtime part reports it to every window.
 */
export declare class PageActivity {
  /**
   * The page document's instance.
   */
  public readonly instance: string;

  /**
   * The control's own id, a UUID in lowercase, the same in each event of the control.
   */
  public readonly activity: string;

  /**
   * The agent's name as the app binds it to the session, or empty when the app binds none.
   */
  public readonly agentName: string;

  /**
   * What the running call does on the page, or what the last one did while none runs.
   */
  public readonly action: PageAction;

  /**
   * Where the control stands.
   */
  public readonly state: PageActivityState;

  /**
   * The element the call acts on, once the call knows it, or null.
   */
  public readonly box: PageBox | null;

  /**
   * Where a click lands, once the call knows it, or null.
   */
  public readonly point: PagePoint | null;

  /**
   * In a navigation's end, the address it didn't open because the person denied its site, or null.
   */
  public readonly refusal: PageRefusal | null;

  /**
   * In a typing or key press's end, true when the person chose to do it themself, so the window that holds the page brings it to them,
   * focused on the field; false otherwise.
   */
  public readonly isHandedOver: boolean;

  /**
   * Creates the activity.
   *
   * @param instance The page document's instance.
   * @param activity The control's own id.
   * @param agentName The agent's name, or empty.
   * @param action What the running call does, or what the last one did.
   * @param state Where the control stands.
   * @param box The element the call acts on, or null.
   * @param point Where a click lands, or null.
   * @param refusal The address a navigation didn't open, or null.
   * @param isHandedOver Whether the person chose to type or press the key themself.
   *
   * @example
   * ```ts
   * import { PageAction, PageActivity, PageActivityState } from "@noldova/browser.protocol";
   *
   * const activity: PageActivity = new PageActivity("0f8fad5b-d9cb-469f-a165-70867728950e", "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", "Scout",
   *   PageAction.Typing, PageActivityState.Asking, null, null, null, false);
   * ```
   */
  public constructor(
    instance: string,
    activity: string,
    agentName: string,
    action: PageAction,
    state: PageActivityState,
    box: PageBox | null,
    point: PagePoint | null,
    refusal: PageRefusal | null,
    isHandedOver: boolean);

  /**
   * Reads the activity from its wire form, `{ instance, activity, agentName, action, state, box, point, refusal, isHandedOver }`, where
   * `box`, `point` and `refusal` are each their class's wire form or null, and none of the nine may be left out.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The activity.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, of the wrong type, not one of the nine or
   * not one of its enum's values, or the box, the point or the refusal isn't one, with the path of the field, such as `$.refusal.origin`.
   *
   * @example
   * ```ts
   * import { PageActivity } from "@noldova/browser.protocol";
   *
   * const activity: PageActivity = PageActivity.fromJson({
   *   instance: "0f8fad5b-d9cb-469f-a165-70867728950e", activity: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "", action: "Reading",
   *   state: "Ended", box: null, point: null, refusal: null, isHandedOver: false
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageActivity;

  /**
   * Writes the activity in its wire form.
   *
   * @returns A new JSON object with all nine fields, `box`, `point` and `refusal` as their wire forms or null.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageAction, PageActivity, PageActivityState, PageBox } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageActivity("0f8fad5b-d9cb-469f-a165-70867728950e", "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", "Scout",
   *   PageAction.Clicking, PageActivityState.Asking, new PageBox(120, 340, 96, 32), null, null, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An address an agent's navigation didn't open because the person denied its site; the page offers the person to allow it.
 */
export declare class PageRefusal {
  /**
   * The address the navigation would have opened, an `http:` or `https:` address.
   */
  public readonly url: string;

  /**
   * Its origin, which the person denied.
   */
  public readonly origin: string;

  /**
   * Creates the refusal.
   *
   * @param url The address, an `http:` or `https:` address.
   * @param origin The address's origin, exactly as `URL` gives it.
   * @throws ArgumentException synchronously when the address isn't an `http:` or `https:` address, naming `url`, or the origin isn't its
   * origin, naming `origin`.
   *
   * @example
   * ```ts
   * import { PageRefusal } from "@noldova/browser.protocol";
   *
   * const refusal: PageRefusal = new PageRefusal("https://docs.example.com/pricing", "https://docs.example.com");
   * ```
   */
  public constructor(url: string, origin: string);

  /**
   * Reads the refusal from its wire form, `{ url, origin }`.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The refusal.
   * @throws JsonException synchronously when the value isn't an object, a field is missing, isn't a string or isn't one of these two,
   * the address isn't a web address or the origin isn't its origin, with the path of the field.
   *
   * @example
   * ```ts
   * import { PageRefusal } from "@noldova/browser.protocol";
   *
   * const refusal: PageRefusal = PageRefusal.fromJson({ url: "https://docs.example.com/pricing", origin: "https://docs.example.com" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PageRefusal;

  /**
   * Writes the refusal in its wire form.
   *
   * @returns A new JSON object with `url` and `origin`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { PageRefusal } from "@noldova/browser.protocol";
   *
   * const json: JsonObject = new PageRefusal("https://docs.example.com/pricing", "https://docs.example.com").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What kind of address a URL's host is, judged without resolving it.
 *
 * @example
 * ```ts
 * import { AddressKind, AddressKinds } from "@noldova/browser.protocol";
 *
 * const isLoopback: boolean = AddressKinds.ofHost("127.0.0.1") === AddressKind.Loopback;
 * ```
 */
export declare const AddressKind: {
  /**
   * Any other host, such as a name on the network or a public IP address, wire value `"Public"`.
   */
  readonly Public: "Public";

  /**
   * `localhost`, a name that ends in `.localhost`, or an address on this computer, such as `127.0.0.1` or `[::1]`, wire value `"Loopback"`.
   */
  readonly Loopback: "Loopback";

  /**
   * An address on a private network, such as `192.168.1.20`, `10.0.0.1`, `100.64.0.1` or `[fd12::1]`, wire value `"Private"`.
   */
  readonly Private: "Private";

  /**
   * A link-local address, such as `169.254.169.254` or `[fe80::1]`, which Browser never opens, wire value `"LinkLocal"`.
   */
  readonly LinkLocal: "LinkLocal";

  /**
   * An address of no host, such as `0.0.0.0` or `[::]`, which Browser never opens, wire value `"Unspecified"`.
   */
  readonly Unspecified: "Unspecified";
};

/**
 * One of {@link AddressKind}'s wire values: `"Public"`, `"Loopback"`, `"Private"`, `"LinkLocal"` or `"Unspecified"`.
 */
export type AddressKind = (typeof AddressKind)[keyof typeof AddressKind];

/**
 * The address kinds of URL hosts, as the browser module judges a typed address and the sites on this computer or network.
 */
export declare class AddressKinds {
  /**
   * Tells what kind of address a host is. An IPv6 address that carries an IPv4 one, mapped, compatible or NAT64, is judged as that IPv4 address.
   *
   * @param hostname A URL's `hostname`, which the URL parser writes in its canonical form: an IPv4 address as four decimal parts, whatever form it was typed in, and an IPv6 one in brackets.
   * @returns The host's {@link AddressKind}.
   * @example
   * ```ts
   * import { AddressKinds } from "@noldova/browser.protocol";
   *
   * AddressKinds.ofHost(new URL("http://0x7f.0.0.1:4173/").hostname);
   * ```
   */
  public static ofHost(hostname: string): AddressKind;
}

/**
 * The limits on addresses that the browser module's parts share.
 */
export declare class AddressLimits {
  /**
   * The most characters a URL may have, as Noldova Desktop limits an address a view opens: a tool's URL, a typed address, and a page's own
   * refused navigation that the workspace's site list could explain.
   *
   * @example
   * ```ts
   * import { AddressLimits } from "@noldova/browser.protocol";
   *
   * const fits: boolean = "https://example.com/".length <= AddressLimits.maximumUrlLength;
   * ```
   */
  public static readonly maximumUrlLength: number;
}

/**
 * The sites the setting Sites on this computer or network, `browser.localSites`, names, read from its text.
 * The runtime part allows their origins, and Settings refuses the entries it leaves out.
 */
export declare class LocalSites {
  /**
   * The origins read, each once, in the URL parser's form: lower case, with a default port left out.
   */
  public readonly origins: readonly string[];

  /**
   * The places, from 1, of the entries left out, among the entries that aren't blank.
   */
  public readonly ignored: readonly number[];

  /**
   * The entries left out, as the person wrote them, trimmed.
   */
  public readonly ignoredEntries: readonly string[];

  private constructor();

  /**
   * Reads the setting's text: `http:` or `https:` origins alone separated by commas, whose host is `localhost`, a name that ends in `.localhost`, or a loopback or private IP address.
   * Blanks and spaces are ignored; any other entry, with a path, query, fragment, user or password, another scheme, another host, or a host that holds a `*` or an empty label, is left out.
   *
   * @param text The setting's text.
   * @returns The sites it names and the entries it leaves out.
   * @example
   * ```ts
   * import { LocalSites } from "@noldova/browser.protocol";
   *
   * const sites: LocalSites = LocalSites.read("http://127.0.0.1:4173, http://0.0.0.0:3000");
   * ```
   */
  public static read(text: string): LocalSites;
}

/**
 * The function the runtime part's risk check runs on an element, with `Runtime.callFunctionOn` by the element's object in the module's own
 * isolated world of the main frame, so the page's own script can't change what it reads; `webViews.json` pins it, so Noldova Desktop's host
 * refuses any other function.
 * It reads only what the page's markup holds, never a field's value, and changes nothing.
 * Given false, it returns by value the names and attributes of the element and of each node above it to the document, through shadow roots,
 * closed ones too, or no path for an element outside the main frame's document; the elements that name the element's form by its id with
 * their `form` attribute; the form's name; and the document's title and base URL.
 * A label, or anything inside one but a link, a button or another field, gives these facts of the control it activates instead of its own.
 * Given true, it returns the element's form itself, the nearest form above it or the one its `form` attribute names, or null, so the runtime
 * part can read the form's whole subtree with `DOM.describeNode`, which, unlike the function, enters closed shadow roots.
 * Given anything else, it returns null.
 */
export declare class ElementFactsScript {
  /**
   * The function's text, which takes one argument, whether to return the element's form rather than its facts, and runs on the element.
   *
   * @example
   * ```ts
   * import { ElementFactsScript } from "@noldova/browser.protocol";
   *
   * const declaration: string = ElementFactsScript.functionDeclaration;
   * ```
   */
  public static readonly functionDeclaration: string;
}

/**
 * The function that tells the runtime part when a frame's page may have moved an element, which the runtime part runs with
 * `Runtime.callFunctionOn` in the module's own isolated world of each frame, and which `webViews.json` pins, so Noldova Desktop's host refuses
 * any other function.
 * While heard, a scroll, a resize, a pinch zoom, a change to the document, a loaded image or font and an ended transition or animation call
 * the world's binding once a frame at most, with no data.
 */
export declare class PageChangeScript {
  /**
   * The isolated world's name, which `webViews.json` pins for `Page.createIsolatedWorld` and `Runtime.addBinding`.
   *
   * @example
   * ```ts
   * import { PageChangeScript } from "@noldova/browser.protocol";
   *
   * const world: string = PageChangeScript.worldName;
   * ```
   */
  public static readonly worldName: string;

  /**
   * The binding's name, which `webViews.json` pins for `Runtime.addBinding`; each call of it is a `Runtime.bindingCalled` event.
   *
   * @example
   * ```ts
   * import { PageChangeScript } from "@noldova/browser.protocol";
   *
   * const binding: string = PageChangeScript.bindingName;
   * ```
   */
  public static readonly bindingName: string;

  /**
   * The function's text, which takes true to start hearing the page and false to stop, and returns true, or false for any other argument
   * or a world without the binding.
   *
   * @example
   * ```ts
   * import { PageChangeScript } from "@noldova/browser.protocol";
   *
   * const declaration: string = PageChangeScript.functionDeclaration;
   * ```
   */
  public static readonly functionDeclaration: string;
}
