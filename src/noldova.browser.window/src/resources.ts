/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AddressKind, AddressKinds, PageAction, type PageActivity, PageActivityState, TypedAddressRefusal } from "@noldova/browser.protocol";

import { AddressRefusal } from "./app/enums/address-refusal.ts";
import { PageStateAction } from "./app/enums/page-state-action.ts";
import { PaneState } from "./app/enums/pane-state.ts";
import { RefusedRequest } from "./app/enums/refused-request.ts";
import { ZoomStep } from "./app/enums/zoom-step.ts";
import { PageStateText } from "./app/models/page-state-text.ts";
import type { PaneStatus } from "./app/models/pane-status.ts";
import type { RefusedPage } from "./app/models/refused-page.ts";

export class Resources {
  public static readonly moduleId: string = "browser";
  public static readonly opaqueOrigin: string = "null";
  public static readonly blankPage: string = "about:blank";
  public static readonly pageDocument: string = "browser.page";
  public static readonly openPageCommand: string = "browser.openPage";
  public static readonly newPageCommand: string = "browser.newPage";
  public static readonly pageTabRowPlace: string = "browser.pageTabRow";
  public static readonly agentPagesItem: string = "browser.agentPages";
  public static readonly agentPagesSeparator: string = ", ";
  public static readonly openPageTitle: string = "Open a page";
  public static readonly newPageTitle: string = "New page";
  public static readonly newPageGlyph: string = "add";
  public static readonly documentArgument: string = "document";
  public static readonly instanceArgument: string = "instance";
  public static readonly linkClickSetting: string = "browser.linkClick";
  public static readonly linkMiddleClickSetting: string = "browser.linkMiddleClick";
  public static readonly systemSitesSetting: string = "browser.systemSites";
  public static readonly localSitesSetting: string = "browser.localSites";
  public static readonly popupSitesSetting: string = "browser.popupSites";
  public static readonly linkProfile: string = "links";
  public static readonly openPageArguments: string = "browser.openPage needs { profileKey, url?, instance? }: a profile key of lowercase letters, digits and hyphens other than links, the address as text, and the instance as a lowercase UUID.";
  public static readonly profileKeyPattern: RegExp = /^[a-z0-9][a-z0-9-]{0,63}$/u;
  public static readonly instancePattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
  public static readonly typedAddressAnswer: string = "The runtime part's answer to a typed address isn't one.";
  public static readonly pageRecordAnswer: string = "The runtime part's page record isn't one.";
  public static readonly pageClaimAnswer: string = "The runtime part's answer to a page's claim isn't one.";
  public static readonly heldPagesAnswer: string = "The runtime part's answer to the window's open pages isn't one.";
  public static readonly appNameAnswer: string = "The runtime part's app name isn't one.";
  public static readonly pageActivitiesAnswer: string = "The runtime part's answer to the pages' activities isn't one.";
  public static readonly pageActivityEvent: string = "The runtime part's activity event isn't one.";
  public static readonly answerRootPath: string = "$";
  public static readonly paneUnavailable: string = "The pane has no embedded view, or the host closed it.";
  public static readonly backgroundTabDisposition: string = "background-tab";
  public static readonly redirectLimit: number = 10;
  public static readonly readyPageLimitMilliseconds: number = 5_000;
  public static readonly notReadyInTime: string =
    `A page's view didn't get its workspace's origins within ${Resources.readyPageLimitMilliseconds / 1_000} s, so it goes to its first address anyway.`;
  public static readonly toolbarLabel: string = "Page";
  public static readonly back: string = "Back";
  public static readonly backGlyph: string = "arrow_back";
  public static readonly forward: string = "Forward";
  public static readonly forwardGlyph: string = "arrow_forward";
  public static readonly reload: string = "Reload";
  public static readonly reloadGlyph: string = "refresh";
  public static readonly stop: string = "Stop";
  public static readonly stopGlyph: string = "close";
  public static readonly address: string = "Address";
  public static readonly notSecure: string = "Not secure";
  public static readonly insecureScheme: string = "http:";
  public static readonly secureScheme: string = "https:";
  public static readonly more: string = "More";
  public static readonly moreGlyph: string = "more_horiz";
  public static readonly idListSeparator: string = " ";
  public static readonly backwardSelection: "backward" = "backward";
  public static readonly agentGlyph: string = "smart_toy";
  public static readonly agentActing: string = "is using this page";
  public static readonly agentAsking: string = "is waiting for your answer";
  public static readonly unnamedAgent: string = "A teammate";
  public static readonly takeOver: string = "Take over";
  public static readonly stopAgent: string = "Stop teammate";
  public static readonly markAsking: string = "waiting for your answer";
  public static readonly markActions: Readonly<Record<PageAction, string>> = {
    [PageAction.Navigating]: "navigating", [PageAction.Reading]: "reading", [PageAction.Clicking]: "clicking", [PageAction.Typing]: "typing",
    [PageAction.PressingKey]: "pressing a key", [PageAction.Waiting]: "waiting"
  };
  public static readonly secureGlyph: string = "lock";
  public static readonly insecureGlyph: string = "no_encryption";
  public static readonly copyGlyph: string = "content_copy";
  public static readonly editGlyph: string = "edit";
  public static readonly narrowToolbarWidth: number = 16;
  public static readonly minimumFieldWidth: number = 2.5;
  public static readonly securityGap: number = 0.25;
  public static readonly externalGlyph: string = "open_in_new";
  public static readonly clearGlyph: string = "delete_sweep";
  public static readonly clearBrowsingData: string = "Clear browsing data…";
  public static readonly clearDataTitle: string = "Clear browsing data?";
  public static readonly clearDataDetail: string = "Sites opened in this workspace forget it: their cookies, sign-ins and stored data are removed, and you sign in to them again.";
  public static readonly clearData: string = "Clear";
  public static readonly cancel: string = "Cancel";
  public static readonly clearDataInitialFocus: string = ".nol-browser-clear-data-cancel";
  public static readonly copyAddress: string = "Copy address";
  public static readonly editAddress: string = "Edit address";
  public static readonly addressCopied: string = "Address copied.";
  public static readonly addressNotCopied: string = "The address wasn't copied.";
  public static readonly openExternal: string = "Open in external browser";
  public static readonly zoom: string = "Zoom";
  public static readonly zoomGlyph: string = "zoom_in";
  public static readonly zoomIn: string = "Zoom in";
  public static readonly zoomInGlyph: string = "add";
  public static readonly zoomOut: string = "Zoom out";
  public static readonly zoomOutGlyph: string = "remove";
  public static readonly resetZoom: string = "Reset to 100%";
  public static readonly resetZoomGlyph: string = "fit_screen";
  public static readonly zoomKeys: Readonly<Record<ZoomStep, { readonly other: string; readonly mac: string }>> = {
    [ZoomStep.In]: { other: "Ctrl+=", mac: "⌘=" }, [ZoomStep.Out]: { other: "Ctrl+-", mac: "⌘-" }, [ZoomStep.Reset]: { other: "Ctrl+0", mac: "⌘0" }
  };
  public static readonly leastZoom: number = 0.25;
  public static readonly greatestZoom: number = 5;
  public static readonly zoomGroup: string = "-zoom";
  public static readonly findOnPage: string = "Find on page";
  public static readonly findGlyph: string = "find_in_page";
  public static readonly findFieldGlyph: string = "search";
  public static readonly findKeys: { readonly other: string; readonly mac: string } = { other: "Ctrl+F", mac: "⌘F" };
  public static readonly findBarLabel: string = "Find on page";
  public static readonly findField: string = "Find";
  public static readonly previousMatch: string = "Previous match";
  public static readonly previousMatchGlyph: string = "keyboard_arrow_up";
  public static readonly nextMatch: string = "Next match";
  public static readonly nextMatchGlyph: string = "keyboard_arrow_down";
  public static readonly closeFind: string = "Close find";
  public static readonly closeFindGlyph: string = "close";
  public static readonly noMatches: string = "No matches";
  public static readonly findTimedOut: string = "The search took too long";
  public static readonly findEnded: string = "The search stopped";
  public static readonly findBarId: string = "nol-browser-find-";
  public static readonly findGroup: string = "-find";
  public static readonly findCountId: string = "-count";
  public static readonly loading: string = "Loading the page";
  public static readonly loadStarted: string = "Loading the page.";
  public static readonly loadStopped: string = "Stopped loading the page.";
  public static readonly loadGroup: string = "-load";
  public static readonly securityId: string = "nol-browser-toolbar-security-";
  public static readonly newTab: string = "New tab";
  public static readonly reloadKey: string = "reload";
  public static readonly newPageKey: string = "newPage";
  public static readonly focusAddressKey: string = "focusAddress";
  public static readonly findKey: string = "find";
  public static readonly stopKey: string = "stop";
  public static readonly reloadChord: string = "Mod+R";
  public static readonly reloadFunctionKey: string = "F5";
  public static readonly newPageChord: string = "Mod+T";
  public static readonly focusAddressChord: string = "Mod+L";
  public static readonly findChord: string = "Mod+F";
  public static readonly enterKey: string = "Enter";
  public static readonly escapeKey: string = "Escape";
  public static readonly macPlatformPrefix: string = "Mac";
  public static readonly windowsPlatformPrefix: string = "Win";
  public static readonly macPlatform: string = "darwin";
  public static readonly windowsPlatform: string = "win32";
  public static readonly linuxPlatform: string = "linux";
  public static readonly pageId: string = "nol-browser-page-";
  public static readonly elsewherePage: PageStateText = new PageStateText("tab", "This page moved to another window",
    "A page shows in one window at a time. Open it again from where you found it to show it here, or close this tab.");
  public static readonly pageStateActions: Readonly<Record<PageStateAction, string>> = {
    [PageStateAction.TryAgain]: "Try again", [PageStateAction.CopyAddress]: "Copy address", [PageStateAction.Back]: "Back", [PageStateAction.Reload]: "Reload",
    [PageStateAction.Close]: "Close", [PageStateAction.AllowSite]: "Allow this site for the workspace", [PageStateAction.NotNow]: "Not now"
  };
  public static readonly refusedRequestNames: Readonly<Partial<Record<RefusedRequest, string>>> = {
    [RefusedRequest.Download]: "download",
    [RefusedRequest.NewWindow]: "newWindow",
    [RefusedRequest.Permission]: "permission",
    [RefusedRequest.FileChooser]: "fileChooser",
    [RefusedRequest.Authentication]: "authentication",
    [RefusedRequest.Certificate]: "certificate",
    [RefusedRequest.NestedView]: "nestedView"
  };
  public static readonly refusedRequestGlyphs: Readonly<Record<RefusedRequest, string>> = {
    [RefusedRequest.Download]: "download",
    [RefusedRequest.NewWindow]: "tab",
    [RefusedRequest.Permission]: "location_off",
    [RefusedRequest.FileChooser]: "upload_file",
    [RefusedRequest.Authentication]: "key_off",
    [RefusedRequest.Certificate]: "gpp_bad",
    [RefusedRequest.NestedView]: "web_asset_off",
    [RefusedRequest.PopupSites]: "block"
  };
  public static readonly refusedAddressGlyph: string = "error";
  public static readonly popupBlocked: string = "Pop-up blocked";
  public static readonly popupBlockedGlyph: string = "open_in_new_off";
  public static readonly openPopup: string = "Open the pop-up";
  public static readonly openPopupGlyph: string = "open_in_new";
  public static readonly allowPopupsGlyph: string = "check_circle";
  public static readonly allowPopupsDescription: string = "Adds the site to Allow pop-ups in Settings, and opens this one";
  public static readonly openerGlyph: string = "subdirectory_arrow_right";
  public static readonly pageErrorGlyph: string = "error";
  public static readonly pageBlockedGlyph: string = "block";
  public static readonly thisBrowser: string = "this browser";
  public static readonly thisBrowserStart: string = "This browser";
  public static readonly noticeId: string = "-notice";
  public static readonly stateHeadingId: string = "-state-heading";
  public static readonly pageStateSelector: string = "nol-browser-page-state";
  public static readonly agentBarSelector: string = "nol-browser-agent-bar";
  public static readonly findBarSelector: string = "nol-browser-find-bar";
  public static readonly inputSelector: string = "input";
  // A page in another state shows no document of its own to find on, or no view at all.
  public static readonly findableStates: readonly PaneState[] = [PaneState.Loading, PaneState.Loaded];
  public static readonly pageSelector: string = ".nol-browser-page";
  public static readonly pageInstanceAttribute: string = "data-instance";
  public static readonly schemePattern: RegExp = /^[a-z][a-z\d+.-]*$/iu;
  public static readonly portPattern: RegExp = /^\d/u;
  public static readonly spacePattern: RegExp = /\s/u;
  public static readonly webSchemeNames: readonly string[] = ["http", "https"];
  public static readonly schemeEnd: string = ":";
  public static readonly defaultScheme: string = "https://";
  public static readonly localScheme: string = "http://";
  public static readonly typedSchemes: readonly string[] = [Resources.localScheme, Resources.defaultScheme];
  public static readonly trailingDotsPattern: RegExp = /\.+$/u;
  public static readonly httpAddressKinds: readonly AddressKind[] = [AddressKind.Loopback, AddressKind.Private];
  public static readonly networkNameSuffix: string = ".local";
  public static readonly localName: string = "localhost";
  public static readonly hostLabelSeparator: string = ".";
  public static readonly ipv6Opening: string = "[";
  public static readonly siteSeparator: string = ",";
  public static readonly siteJoiner: string = ", ";
  public static readonly siteSchemes: readonly string[] = [Resources.insecureScheme, Resources.secureScheme];
  public static readonly wildcardPattern: RegExp = /^([^:/?#]+:\/\/)?\*\./u;
  public static readonly wildcardReplacement: string = "$1";
  public static readonly trailingDotPattern: RegExp = /\.$/u;
  public static readonly schemeSeparator: string = "://";
  public static readonly hostTextPattern: RegExp = /^[^\s/\\:@?#[\]%*]+$/u;
  public static readonly emptyLabel: string = "..";
  private static readonly loadFailures: ReadonlyMap<string, string> = new Map<string, string>([
    ["ERR_NAME_NOT_RESOLVED", "The server couldn't be found (DNS)."],
    ["ERR_CONNECTION_REFUSED", "The server refused the connection."],
    ["ERR_CONNECTION_TIMED_OUT", "The server took too long to answer."],
    ["ERR_TIMED_OUT", "The server took too long to answer."],
    ["ERR_INTERNET_DISCONNECTED", "This computer isn't connected to the internet."],
    ["ERR_ADDRESS_UNREACHABLE", "The server's address can't be reached from this network."]
  ]);
  private static readonly refusedAddresses: Readonly<Record<AddressRefusal, (browser: string) => string>> = {
    [AddressRefusal.NotAnAddress]: () => "Type a web address, such as example.com.",
    [AddressRefusal.NotWeb]: t => `${t} opens only addresses that start with http: or https:.`,
    [AddressRefusal.TooLong]: () => "This address is too long to open.",
    [AddressRefusal.Credentials]: t => `${t} doesn't open addresses with a user name or password.`,
    [AddressRefusal.Local]: t => `${t} opens an address on this computer or its network only once Settings names its site, under Sites on this computer or network.`,
    [AddressRefusal.NeverAllowed]: t => `${t} never opens this address.`,
    [AddressRefusal.Failed]: t => `${t} couldn't allow this address's site in the workspace. Try again.`
  };
  private static readonly refusedRequests: Readonly<Record<RefusedRequest, (browser: string) => string>> = {
    [RefusedRequest.Download]: t => `Downloads aren't available in ${t} yet.`,
    [RefusedRequest.NewWindow]: t => `This page asked for a new window, and ${t} didn't open it.`,
    [RefusedRequest.Permission]: t => `Site permissions, such as the camera or your location, aren't available in ${t} yet.`,
    [RefusedRequest.FileChooser]: t => `Opening files from this computer isn't available in ${t} yet.`,
    [RefusedRequest.Authentication]: t => `Sign-in dialogs aren't available in ${t} yet.`,
    [RefusedRequest.Certificate]: t => `This page's certificate wasn't accepted, so ${t} didn't open it.`,
    [RefusedRequest.NestedView]: t => `Pages shown inside other pages aren't available in ${t} yet.`,
    [RefusedRequest.PopupSites]: t => `Settings didn't add this site to Allow pop-ups, so ${t} still blocks its pop-ups.`
  };

  // The pane names the module as the app's browser wherever it speaks of it, or as this browser while the app's name is unknown.
  public static formatBrowser(appName: string | null): string {
    return appName === null ? Resources.thisBrowser : `${appName}'s browser`;
  }

  public static formatPagesInactive(appName: string | null): string {
    return `${Resources.formatBrowserStart(appName)} can't show a page here, since its window part isn't active.`;
  }

  public static formatBrowserStart(appName: string | null): string {
    return appName === null ? Resources.thisBrowserStart : `${appName}'s browser`;
  }

  public static formatForgottenPage(appName: string | null): PageStateText {
    return new PageStateText("history", "This page can't open again",
      `${Resources.formatBrowserStart(appName)} no longer knows which workspace it belonged to. Close it, and open the page again from where you found it.`);
  }

  public static formatRefusedAddress(refusal: AddressRefusal, appName: string | null): string {
    return Resources.refusedAddresses[refusal](Resources.formatBrowserStart(appName));
  }

  public static formatPageStateText(status: PaneStatus, appName: string | null): PageStateText {
    const browser: string = Resources.formatBrowserStart(appName);
    switch (status.state) {
      case PaneState.Empty:
        return new PageStateText("travel_explore", "Type an address to open a page", null);
      case PaneState.Failed: {
        const reason: string = `${status.failureReason}`;
        const why: string = Resources.loadFailures.get(reason) ?? `The page didn't load (${reason}).`;
        return new PageStateText("cloud_off", `Can't reach ${Resources.hostOf(status.url)}`, `The address may be mistyped, or the site is down. ${why}`);
      }
      case PaneState.Refused:
        return status.refusedAddress === TypedAddressRefusal.Credentials || status.refusedAddress === TypedAddressRefusal.TooLong
          ? new PageStateText("block", `${browser} doesn't open this address`, "Edit the address in the field to open its site.")
          : status.mayBeUnlisted && status.refusedAddress === null && status.refusedOrigin !== null && Resources.isPublicWebOrigin(status.refusedOrigin)
            ? new PageStateText("block", `This workspace doesn't allow ${status.refusedOrigin}`,
              "This address isn't among the sites this workspace allows. Type it in the address field to open it.")
            : new PageStateText("block", status.refusedOrigin === Resources.opaqueOrigin ? `${browser} doesn't open this page` : `${browser} doesn't open ${status.refusedOrigin}`,
              `Its address isn't one ${Resources.formatBrowser(appName)} opens.`);
      case PaneState.Crashed:
        return new PageStateText("sentiment_dissatisfied", "This page stopped working", "Its content process ended. Reload to open it again; anything typed into it is lost.");
      default:
        return new PageStateText("web_asset_off", `${browser} can't show pages here`, null);
    }
  }

  public static hostOf(url: string): string {
    return URL.canParse(url) && new URL(url).host !== "" ? new URL(url).host : url;
  }

  public static formatAgentName(agentName: string): string {
    return agentName.trim() === "" ? Resources.unnamedAgent : agentName;
  }

  public static formatAgentMessage(name: string, phrase: string): string {
    return `${name} ${phrase}`;
  }

  public static formatAgentPages(name: string, count: number): string {
    return `${name} · ${count} ${count === 1 ? "page" : "pages"} open`;
  }

  public static formatRefusalText(refused: RefusedPage): PageStateText {
    return new PageStateText("block", `${Resources.formatAgentName(refused.agentName)} can't open ${Resources.hostOf(refused.url)}`,
      `This address isn't among the sites this workspace allows. ${Resources.formatAgentName(refused.agentName)} asked to open it; you can allow it, or type it yourself to open it.`);
  }

  public static formatMarkGlyph(action: PageAction): string {
    return action === PageAction.Typing ? "keyboard" : "ads_click";
  }

  public static formatMarkTag(activity: PageActivity): string {
    return `${Resources.formatAgentName(activity.agentName)} · ${activity.state === PageActivityState.Asking ? Resources.markAsking : Resources.markActions[activity.action]}`;
  }

  public static formatRingStart(pixels: number): string {
    return `max(0px, calc(${pixels}px - var(--nol-browser-mark-ring-offset)))`;
  }

  public static formatRingLength(start: number, length: number): string {
    return `calc(${length}px + 2 * var(--nol-browser-mark-ring-offset) - max(0px, var(--nol-browser-mark-ring-offset) - ${start}px))`;
  }

  // The tag starts no later than its least width before the right edge, so the edge never cuts its glyph. The step term leaves a tag under an element past the edge at its place.
  public static formatTagStart(pixels: number): string {
    const place: string = `${pixels}px - var(--nol-browser-mark-tag-offset)`;
    return `max(0px, min(${place}, max(100% - var(--nol-browser-mark-tag-least), (${pixels}px - 100%) * 100000)))`;
  }

  // The space from the tag's start to the page's right edge, so a tag near that edge is cut with its ellipsis rather than by the edge.
  public static formatTagSpace(pixels: number): string {
    return `calc(100% - ${Resources.formatTagStart(pixels)})`;
  }

  public static formatTagTop(pixels: number): string {
    return `calc(${pixels}px + var(--nol-browser-mark-tag-gap))`;
  }

  public static formatPointerStart(pixels: number): string {
    return `calc(${pixels}px - var(--nol-browser-pointer-offset))`;
  }

  public static formatTabTitle(url: string): string {
    return url === "" ? Resources.newTab : url;
  }

  public static formatZoom(factor: number): string {
    return `${String(Math.round(factor * 100))}%`;
  }

  public static formatZoomed(factor: number): string {
    return `Zoom ${Resources.formatZoom(factor)}.`;
  }

  public static formatMatches(active: number, matches: number): string {
    return matches === 0 ? Resources.noMatches : `${String(active)} of ${String(matches)}`;
  }

  public static formatLinkRefused(reason: TypedAddressRefusal): string {
    return `The runtime part refused the link's address (${reason}), so it opens in the system's browser.`;
  }

  public static formatPageInAnotherWindow(instance: string): string {
    return `The page ${instance} is open in another window.`;
  }

  public static formatPageOnOtherWorkspace(instance: string): string {
    return `The page ${instance} is open on another workspace.`;
  }

  public static formatPopupBlocked(host: string): string {
    return `${host} tried to open a pop-up, which was blocked. The address bar's Pop-up blocked can open it.`;
  }

  public static formatAllowPopups(host: string): string {
    return `Always allow pop-ups from ${host}`;
  }

  public static formatPopupsNotAllowed(error: unknown): string {
    return `The site wasn't added to the sites allowed to open pop-ups: ${Resources.kindOf(error)}.`;
  }

  public static formatRefusedRequest(request: RefusedRequest, appName: string | null): string {
    return Resources.refusedRequests[request](Resources.formatBrowser(appName));
  }

  public static formatNoAppName(error: unknown): string {
    return `The app's name wasn't read, so notices name no app: ${Resources.kindOf(error)}.`;
  }

  public static formatNewPageNotOpened(error: unknown): string {
    return `The new page didn't open: ${Resources.kindOf(error)}.`;
  }

  public static formatOpenedFrom(title: string): string {
    return `Opened from ${title}`;
  }

  public static formatNewWindowNotOpened(error: unknown): string {
    return `A page's new window didn't open as a page: ${Resources.kindOf(error)}.`;
  }

  public static formatViewNotOpened(error: unknown): string {
    return `A page's view didn't open, so its tab shows no page: ${Resources.kindOf(error)}.`;
  }

  public static formatNotReady(error: unknown): string {
    return `A page's view didn't get its workspace's origins before its first address: ${Resources.kindOf(error)}.`;
  }

  public static formatNotOpened(error: unknown): string {
    return `A page didn't go to its first address: ${Resources.kindOf(error)}.`;
  }

  public static formatAnswerItemPath(index: number): string {
    return `${Resources.answerRootPath}.${index}`;
  }

  public static formatActivityNotRead(error: unknown): string {
    return `A teammate's call on a page wasn't shown: ${Resources.kindOf(error)}.`;
  }

  public static formatActivitiesNotRead(error: unknown): string {
    return `The teammates' calls on the pages weren't read again after the runtime started, so the pages show only the calls that start now: ${Resources.kindOf(error)}.`;
  }

  public static formatNotStopped(error: unknown): string {
    return `A teammate's call on a page wasn't stopped: ${Resources.kindOf(error)}.`;
  }

  public static formatOpenPagesNotHeld(error: unknown): string {
    return `The window's open pages weren't held, so another window may open one of them too: ${Resources.kindOf(error)}.`;
  }

  public static formatOpenPagesNotRead(error: unknown): string {
    return `The window's open pages weren't read, so another window may open one of them too: ${Resources.kindOf(error)}.`;
  }

  public static formatRedirectNotFollowed(error: unknown): string {
    return `A typed address's redirect to another site wasn't followed: ${Resources.kindOf(error)}.`;
  }

  public static formatLeftEntryFailed(error: unknown): string {
    return `A typed address the person left failed after it: ${Resources.kindOf(error)}.`;
  }

  public static formatRedirectsNotEnded(error: unknown): string {
    return `A typed address's redirects weren't ended: ${Resources.kindOf(error)}.`;
  }

  public static formatNotLetGo(error: unknown): string {
    return `A page the window claimed wasn't let go, so another window may not open it until this window closes: ${Resources.kindOf(error)}.`;
  }

  public static formatNotKept(error: unknown): string {
    return `A page's record wasn't kept or forgotten, so the window may not restore it: ${Resources.kindOf(error)}.`;
  }

  public static formatIgnoredSites(places: readonly number[]): string {
    return `The sites that always open in the system's browser ignore the entries that aren't hosts, at ${places.join(", ")} in the list.`;
  }

  public static formatIgnoredPopupSites(places: readonly number[]): string {
    return `The sites allowed to open pop-ups ignore the entries that aren't hosts, at ${places.join(", ")} in the list.`;
  }

  public static formatRefusedSites(entries: readonly string[]): string {
    const named: string = entries.map(t => `"${t}"`).join(", ");
    return `${named} ${entries.length === 1 ? "isn't a host" : "aren't hosts"}. Enter hosts separated by commas, such as example.com.`;
  }

  public static formatRefusedLocalSites(entries: readonly string[]): string {
    const named: string = entries.map(t => `"${t}"`).join(", ");
    return `${named} ${entries.length === 1 ? "isn't a site's address" : "aren't sites' addresses"} on this computer or network. Enter addresses with http:// or https://, as localhost or an IP address, and no path, separated by commas, such as http://localhost:4173; for a server on 0.0.0.0, enter http://127.0.0.1:<port>.`;
  }

  public static formatSubdomainSuffix(host: string): string {
    return `.${host}`;
  }

  public static formatDefaultSchemeAddress(entry: string): string {
    return `${Resources.defaultScheme}${entry}`;
  }

  public static formatHostAddress(host: string): string {
    return `${Resources.defaultScheme}${host}/`;
  }

  public static formatLoaded(page: string): string {
    return `${page} loaded.`;
  }

  // A public site's origin over http or https: the only kind the workspace's site list can be missing, since typing its address adds
  // it to the list; any other origin, or an opaque one's address, is refused by its kind, whatever the list says.
  private static isPublicWebOrigin(origin: string): boolean {
    const parsed: URL | null = URL.parse(origin);
    return parsed !== null && Resources.webSchemeNames.includes(parsed.protocol.slice(0, -Resources.schemeEnd.length))
      && AddressKinds.ofHost(parsed.hostname) === AddressKind.Public;
  }

  private static kindOf(error: unknown): string {
    if (error instanceof Error)
      return error.name;
    return typeof error;
  }
}
