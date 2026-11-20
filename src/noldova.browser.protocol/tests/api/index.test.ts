/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import * as api from "../../src/api/index.ts";
import { AddressKind } from "../../src/enums/address-kind.ts";
import { PageAction } from "../../src/enums/page-action.ts";
import { PageActivityState } from "../../src/enums/page-activity-state.ts";
import { TypedAddressAnswerKind } from "../../src/enums/typed-address-answer-kind.ts";
import { TypedAddressRefusal } from "../../src/enums/typed-address-refusal.ts";
import { AddressKinds } from "../../src/models/address-kinds.ts";
import { AddressLimits } from "../../src/models/address-limits.ts";
import { BrowserEvents } from "../../src/models/browser-events.ts";
import { BrowserMethods } from "../../src/models/browser-methods.ts";
import { BrowserToolNames } from "../../src/models/browser-tool-names.ts";
import { BrowsingDataRequest } from "../../src/models/browsing-data-request.ts";
import { HeldPages } from "../../src/models/held-pages.ts";
import { LocalSites } from "../../src/models/local-sites.ts";
import { OpenPagesRequest } from "../../src/models/open-pages-request.ts";
import { PageActivity } from "../../src/models/page-activity.ts";
import { PageAgent } from "../../src/models/page-agent.ts";
import { PageBox } from "../../src/models/page-box.ts";
import { ElementFactsScript } from "../../src/models/element-facts-script.ts";
import { PageChangeScript } from "../../src/models/page-change-script.ts";
import { PageClaim } from "../../src/models/page-claim.ts";
import { PagePoint } from "../../src/models/page-point.ts";
import { PageRecord } from "../../src/models/page-record.ts";
import { PageRefusal } from "../../src/models/page-refusal.ts";
import { PageRequest } from "../../src/models/page-request.ts";
import { PageStopRequest } from "../../src/models/page-stop-request.ts";
import { TypedAddressAllowed } from "../../src/models/typed-address-allowed.ts";
import { TypedAddressRefused } from "../../src/models/typed-address-refused.ts";
import { TypedAddressRequest } from "../../src/models/typed-address-request.ts";
import { TypedRedirectRequest } from "../../src/models/typed-redirect-request.ts";
import { TypedAddressAnswerReader } from "../../src/services/typed-address-answer.reader.ts";

describe("@noldova/browser.protocol", () => {
  it("exports exactly its public values", () => {
    expect(Object.keys(api).sort()).toEqual([
      "AddressKind", "AddressKinds", "AddressLimits", "BrowserEvents", "BrowserMethods", "BrowserToolNames", "BrowsingDataRequest", "ElementFactsScript", "HeldPages", "LocalSites", "OpenPagesRequest",
      "PageAction", "PageActivity", "PageActivityState", "PageAgent", "PageBox", "PageChangeScript", "PageClaim", "PagePoint", "PageRecord", "PageRefusal", "PageRequest",
      "PageStopRequest", "TypedAddressAllowed", "TypedAddressAnswerKind", "TypedAddressAnswerReader", "TypedAddressRefusal", "TypedAddressRefused",
      "TypedAddressRequest", "TypedRedirectRequest"
    ]);
    expect([api.AddressKind, api.PageAction, api.PageActivityState, api.TypedAddressAnswerKind, api.TypedAddressRefusal])
      .toEqual([AddressKind, PageAction, PageActivityState, TypedAddressAnswerKind, TypedAddressRefusal]);
    expect([
      api.AddressKinds, api.AddressLimits, api.BrowserEvents, api.BrowserMethods, api.BrowserToolNames, api.BrowsingDataRequest, api.ElementFactsScript, api.HeldPages, api.LocalSites, api.OpenPagesRequest,
      api.PageActivity, api.PageAgent, api.PageBox, api.PageChangeScript, api.PageClaim, api.PagePoint, api.PageRecord, api.PageRefusal, api.PageRequest, api.PageStopRequest,
      api.TypedAddressAllowed, api.TypedAddressRefused, api.TypedAddressRequest, api.TypedRedirectRequest, api.TypedAddressAnswerReader
    ].map((t, index) => t === [
      AddressKinds, AddressLimits, BrowserEvents, BrowserMethods, BrowserToolNames, BrowsingDataRequest, ElementFactsScript, HeldPages, LocalSites, OpenPagesRequest, PageActivity, PageAgent, PageBox,
      PageChangeScript, PageClaim, PagePoint, PageRecord, PageRefusal, PageRequest, PageStopRequest, TypedAddressAllowed, TypedAddressRefused, TypedAddressRequest,
      TypedRedirectRequest, TypedAddressAnswerReader
    ][index])).toEqual(Array.from({ length: 25 }, () => true));
  });

  it("spells each enum's wire values as its members' names", () => {
    expect([AddressKind, PageAction, PageActivityState, TypedAddressAnswerKind, TypedAddressRefusal].map(t => Object.entries(t))).toEqual([
      [["Public", "Public"], ["Loopback", "Loopback"], ["Private", "Private"], ["LinkLocal", "LinkLocal"], ["Unspecified", "Unspecified"]],
      [["Navigating", "Navigating"], ["Reading", "Reading"], ["Clicking", "Clicking"], ["Typing", "Typing"], ["PressingKey", "PressingKey"], ["Waiting", "Waiting"]],
      [["Acting", "Acting"], ["Asking", "Asking"], ["Idle", "Idle"], ["Ended", "Ended"]],
      [["Allowed", "Allowed"], ["Refused", "Refused"]],
      [["NotAnAddress", "NotAnAddress"], ["NotWeb", "NotWeb"], ["TooLong", "TooLong"], ["Credentials", "Credentials"], ["Local", "Local"], ["NeverAllowed", "NeverAllowed"]]
    ]);
  });
});
