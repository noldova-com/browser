/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext, Migration, RegistrationException } from "@noldova/desktop.runtime";

/**
 * The runtime part's limits on what a tool takes and returns, each below Noldova Desktop's own time and size limits.
 */
export declare class BrowserLimits {
  /**
   * The most characters a URL that a tool receives may have.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const fits: boolean = "https://example.com/".length <= BrowserLimits.maximumUrlLength;
   * ```
   */
  public static readonly maximumUrlLength: number;

  /**
   * The most characters of text one call may type.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const fits: boolean = "hello".length <= BrowserLimits.maximumTypedTextLength;
   * ```
   */
  public static readonly maximumTypedTextLength: number;

  /**
   * The most characters of an element reference, such as `e12`, that a tool receives.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const fits: boolean = "e12".length <= BrowserLimits.maximumReferenceLength;
   * ```
   */
  public static readonly maximumReferenceLength: number;

  /**
   * The longest time, in milliseconds, that one wait may take.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const seconds: number = BrowserLimits.maximumWaitMilliseconds / 1_000;
   * ```
   */
  public static readonly maximumWaitMilliseconds: number;

  /**
   * The most bytes of snapshot text one result may carry; a longer snapshot is cut, and the cut is marked.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const kibibytes: number = BrowserLimits.maximumSnapshotBytes / 1024;
   * ```
   */
  public static readonly maximumSnapshotBytes: number;

  /**
   * The most bytes of a page's reply that carries a whole tree, such as its accessibility tree or its document; a larger reply fails the call.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const mebibytes: number = BrowserLimits.maximumTreeReplyBytes / (1024 * 1024);
   * ```
   */
  public static readonly maximumTreeReplyBytes: number;

  /**
   * The most elements a page may hold, open shadow roots' too, for a snapshot to read its whole accessibility tree in one reply; a page with
   * more is read a node's children at a time, since its whole tree passes the reply limit.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const thousands: number = BrowserLimits.maximumWholeTreeElements / 1_000;
   * ```
   */
  public static readonly maximumWholeTreeElements: number;

  /**
   * The most bytes of a page's reply that describes one node or a frame tree; a larger reply fails the call.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const kibibytes: number = BrowserLimits.maximumNodeReplyBytes / 1024;
   * ```
   */
  public static readonly maximumNodeReplyBytes: number;

  /**
   * The most console entries and page errors that a pane keeps; the oldest go first.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const isFull: boolean = 600 >= BrowserLimits.consoleRingEntries;
   * ```
   */
  public static readonly consoleRingEntries: number;

  /**
   * The most bytes of console entries that a pane keeps; the oldest go first.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const kibibytes: number = BrowserLimits.consoleRingBytes / 1024;
   * ```
   */
  public static readonly consoleRingBytes: number;

  /**
   * The most bytes of one console entry; a longer entry is cut.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const fits: boolean = new TextEncoder().encode("Loaded.").length <= BrowserLimits.maximumConsoleEntryBytes;
   * ```
   */
  public static readonly maximumConsoleEntryBytes: number;

  /**
   * The most pixels of a screenshot's longer side; a larger screenshot is scaled down.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const scale: number = Math.min(1, BrowserLimits.maximumScreenshotSide / 4_000);
   * ```
   */
  public static readonly maximumScreenshotSide: number;

  /**
   * The most bytes of an encoded screenshot.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const kibibytes: number = BrowserLimits.maximumScreenshotBytes / 1024;
   * ```
   */
  public static readonly maximumScreenshotBytes: number;

  /**
   * How long, in milliseconds, a screenshot waits for the page to draw before it lays a hidden page out for the capture.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const seconds: number = BrowserLimits.screenshotDrawMilliseconds / 1_000;
   * ```
   */
  public static readonly screenshotDrawMilliseconds: number;

  /**
   * The width, in CSS pixels, at which a page that has no size while hidden is laid out for a press or a capture.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const isWide: boolean = BrowserLimits.hiddenPageWidth > BrowserLimits.hiddenPageHeight;
   * ```
   */
  public static readonly hiddenPageWidth: number;

  /**
   * The height, in CSS pixels, at which a page that has no size while hidden is laid out for a press or a capture.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const area: number = BrowserLimits.hiddenPageWidth * BrowserLimits.hiddenPageHeight;
   * ```
   */
  public static readonly hiddenPageHeight: number;

  /**
   * The most code points of the URL in a result's structured fields, the cut mark included; a longer URL is cut.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const fits: boolean = [..."https://example.com/"].length <= BrowserLimits.maximumShownUrlLength;
   * ```
   */
  public static readonly maximumShownUrlLength: number;

  /**
   * The most code points of a title, role or name in a result's structured fields, the cut mark included; a longer one is cut.
   *
   * @example
   * ```ts
   * import { BrowserLimits } from "@noldova/browser/runtime";
   *
   * const fits: boolean = [..."Checkout"].length <= BrowserLimits.maximumShownTextLength;
   * ```
   */
  public static readonly maximumShownTextLength: number;
}

/**
 * The browser module's runtime part, which Noldova Desktop loads and activates.
 *
 * @remarks
 * While active, it registers the module's agent tools with Noldova Desktop's tool registry, gives each web view that opens its workspace's
 * allowed origins, and forgets an agent's element references and console cursors for a view that closes, crashes or loses its profile.
 */
export declare class RuntimePart implements IRuntimePart {
  /**
   * The migrations of the module's database, in order: the allowed origins of each workspace, the open pages' records, then the agent whose call last acted on each page.
   * Noldova Desktop runs them before it activates the part.
   *
   * @example
   * ```ts
   * import { RuntimePart } from "@noldova/browser/runtime";
   *
   * const ids: readonly string[] = new RuntimePart().migrations.map(t => t.id);
   * ```
   */
  public readonly migrations: readonly Migration[];

  /**
   * Registers the tools and the window part's methods, and starts following the module's web views.
   *
   * @param context The runtime's context for this part.
   * @returns A promise that resolves once every tool and method is registered.
   * @throws {RegistrationException} The promise rejects, having withdrawn what it registered, when Noldova Desktop's registry refuses a tool,
   * a method or an event.
   * @example
   * ```ts
   * import { RuntimePart } from "@noldova/browser/runtime";
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function startAsync(context: IRuntimePartContext): Promise<RuntimePart> {
   *   const part: RuntimePart = new RuntimePart();
   *   await part.activateAsync(context);
   *   return part;
   * }
   * ```
   */
  public activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Withdraws the tools and the methods and stops following the web views.
   *
   * @returns A promise that resolves once they are withdrawn; it never rejects.
   * Calling it again, or before {@link RuntimePart.activateAsync}, does nothing.
   * @example
   * ```ts
   * import { RuntimePart } from "@noldova/browser/runtime";
   *
   * await new RuntimePart().deactivateAsync();
   * ```
   */
  public deactivateAsync(): Promise<void>;
}
