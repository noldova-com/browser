/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRefusal } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { PaneState } from "../../../src/app/enums/pane-state.ts";
import { RefusedRequest } from "../../../src/app/enums/refused-request.ts";
import { PaneStatus } from "../../../src/app/models/pane-status.ts";
import { PopupOffer } from "../../../src/app/models/popup-offer.ts";
import { ViewCloseEvent } from "../../../src/app/models/view-close-event.ts";
import { ViewCrashEvent } from "../../../src/app/models/view-crash-event.ts";
import { ViewLoadFailureEvent } from "../../../src/app/models/view-load-failure-event.ts";
import { ViewProfileClearedEvent } from "../../../src/app/models/view-profile-cleared-event.ts";
import { ViewRefusalEvent } from "../../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";

describe("PaneStatus", () => {
  function shown(status: PaneStatus): Partial<PaneStatus> {
    return {
      state: status.state, url: status.url, title: status.title, canGoBack: status.canGoBack, canGoForward: status.canGoForward, failureReason: status.failureReason,
      refusedOrigin: status.refusedOrigin, refusedRequest: status.refusedRequest, refusedTarget: status.refusedTarget, refusedAddress: status.refusedAddress, popup: status.popup
    };
  }

  function state(address: string, title: string, isLoading: boolean, canGoBack: boolean = false, canGoForward: boolean = false): ViewStateEvent {
    return new ViewStateEvent(address, title, isLoading, canGoBack, canGoForward);
  }

  const loaded: PaneStatus = PaneStatus.empty
    .apply(state("https://one.example/", "", true))
    .apply(state("https://one.example/", "One", false, true, false));

  it("starts empty, with no address, title, history or problem", () => {
    expect(shown(PaneStatus.empty)).toEqual({
      state: PaneState.Empty,
      url: "",
      title: "",
      canGoBack: false,
      canGoForward: false,
      failureReason: null,
      refusedOrigin: null,
      refusedRequest: null,
      refusedTarget: null,
      refusedAddress: null,
      popup: null
    });
  });

  it("is unavailable without a view, with no address, title, history or problem", () => {
    expect(shown(PaneStatus.unavailable)).toEqual({
      state: PaneState.Unavailable,
      url: "",
      title: "",
      canGoBack: false,
      canGoForward: false,
      failureReason: null,
      refusedOrigin: null,
      refusedRequest: null,
      refusedTarget: null,
      refusedAddress: null,
      popup: null
    });
  });

  it("loads: a state while loading, then one once it stops, each with its address, title and history", () => {
    expect(shown(loaded)).toEqual({
      state: PaneState.Loaded,
      url: "https://one.example/",
      title: "One",
      canGoBack: true,
      canGoForward: false,
      failureReason: null,
      refusedOrigin: null,
      refusedRequest: null,
      refusedTarget: null,
      refusedAddress: null,
      popup: null
    });
  });

  it("follows a state that changes only the title or the history, and keeps its own state", () => {
    const titled: PaneStatus = loaded.apply(state("https://one.example/", "One, again", false, true, true));

    expect(titled.state).toBe(PaneState.Loaded);
    expect(titled.title).toBe("One, again");
    expect(titled.canGoForward).toBe(true);
    expect(PaneStatus.empty.apply(state("", "", false)).state).toBe(PaneState.Empty);
  });

  it("fails with the address that failed and the description, and keeps that through the stop of loading", () => {
    const failed: PaneStatus = loaded
      .apply(state("https://gone.example/", "One", true, true))
      .apply(new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED"))
      .apply(state("https://gone.example/", "One", false, true));

    expect(failed.state).toBe(PaneState.Failed);
    expect(failed.url).toBe("https://gone.example/");
    expect(failed.failureReason).toBe("ERR_NAME_NOT_RESOLVED");
  });

  it("is refused with the refused origin, by an event or a refusal, while the address stays the page's", () => {
    const byEvent: PaneStatus = loaded.apply(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", true));
    const byAnswer: PaneStatus = loaded.refuse("https://refused.example");

    for (const refused of [byEvent, byAnswer]) {
      expect(refused.state).toBe(PaneState.Refused);
      expect(refused.url).toBe("https://one.example/");
      expect(refused.title).toBe("One");
      expect(refused.refusedOrigin).toBe("https://refused.example");
    }
    expect(byAnswer.refuse("https://refused.example")).toBe(byAnswer);
    expect(byAnswer.refuse("https://other.example").refusedOrigin).toBe("https://other.example");
  });

  it("keeps a page's own refused navigation shown through its load and stop when the refusal comes first", () => {
    const refused: PaneStatus = loaded.apply(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false));
    const loading: PaneStatus = refused.apply(state("https://one.example/", "One", true, true, false));
    const stopped: PaneStatus = loading.apply(state("https://one.example/", "One", false, true, false));

    expect([loading.state, loading.refusedOrigin, stopped.state, stopped.refusedOrigin, stopped.url]).toEqual([
      PaneState.Refused, "https://refused.example", PaneState.Refused, "https://refused.example", "https://one.example/"
    ]);
  });

  it("keeps a page's own refused navigation shown through its stop when its load starts first", () => {
    const loading: PaneStatus = loaded.apply(state("https://one.example/", "One", true, true, false));
    const refused: PaneStatus = loading.apply(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false));
    const stopped: PaneStatus = refused.apply(state("https://one.example/", "One", false, true, false));

    expect([refused.state, stopped.state, stopped.refusedOrigin, stopped.url]).toEqual([PaneState.Refused, PaneState.Refused, "https://refused.example", "https://one.example/"]);
    expect(stopped.apply(state("https://one.example/", "One", true, true, false)).state).toBe(PaneState.Loading);
  });

  it("ends a page's own refused navigation's hold at the view's next state, so a later load, or one at another address, clears the refusal", () => {
    const refused: PaneStatus = loaded.apply(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false));
    const stopped: PaneStatus = refused.apply(state("https://one.example/", "One", true)).apply(state("https://one.example/", "One", false));

    expect([
      refused.apply(state("https://two.example/", "", true)).state,
      refused.apply(state("https://one.example/#part", "One", false)).apply(state("https://one.example/#part", "One", true)).state,
      refused.refuseRequest(RefusedRequest.Download).apply(state("https://one.example/", "One", true)).state,
      stopped.state,
      stopped.apply(state("https://one.example/", "One", true)).state
    ]).toEqual([PaneState.Loading, PaneState.Loading, PaneState.Loading, PaneState.Refused, PaneState.Loading]);
    expect(refused.apply(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false))).toBe(refused);
  });

  it("ends a page's own refused navigation's hold for a navigation the person or an agent starts, and keeps the refusal shown", () => {
    const refused: PaneStatus = loaded.apply(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false));

    expect([refused.navigate().state, refused.navigate().refusedOrigin, refused.navigate().apply(state("https://one.example/", "One", true)).state])
      .toEqual([PaneState.Refused, "https://refused.example", PaneState.Loading]);
    expect(loaded.navigate()).toBe(loaded);
  });

  it("drops a page's own refused navigation's hold for a crash, a failure and a closed view", () => {
    const refused: PaneStatus = loaded.apply(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false));
    const crashed: PaneStatus = refused.apply(new ViewCrashEvent());
    const failed: PaneStatus = refused.apply(new ViewLoadFailureEvent("https://one.example/", -2, "ERR_FAILED"));

    expect([crashed.apply(state("https://one.example/", "One", true)).state, failed.apply(state("https://one.example/", "One", true)).state])
      .toEqual([PaneState.Loading, PaneState.Loading]);
    expect(refused.apply(new ViewCloseEvent())).toBe(PaneStatus.unavailable);
  });

  it("crashes, and a new load clears the crash, a failure and a refusal", () => {
    expect(loaded.apply(new ViewCrashEvent()).state).toBe(PaneState.Crashed);
    for (const problem of [
      loaded.apply(new ViewCrashEvent()),
      loaded.apply(new ViewLoadFailureEvent("https://gone.example/", -2, "ERR_FAILED")),
      loaded.refuse("https://refused.example")
    ]) {
      const reloading: PaneStatus = problem.apply(state("https://one.example/", "One", true));
      expect(reloading.state).toBe(PaneState.Loading);
      expect(reloading.failureReason).toBe(null);
      expect(reloading.refusedOrigin).toBe(null);
    }
  });

  it("changes nothing shown for a cleared profile", () => {
    expect(loaded.apply(new ViewProfileClearedEvent("workspace-1"))).toBe(loaded);
  });

  it("keeps the latest refused request beside the page, the one before replaced", () => {
    const download: PaneStatus = loaded.apply(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example"));
    const newWindow: PaneStatus = download.apply(new ViewRequestRefusalEvent(RefusedRequest.NewWindow, "https://one.example"));

    expect([download.refusedRequest, download.state, download.url, download.title, download.canGoBack]).toEqual([RefusedRequest.Download, PaneState.Loaded, "https://one.example/", "One", true]);
    expect(download.apply(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example"))).toBe(download);
    expect(newWindow.refusedRequest).toBe(RefusedRequest.NewWindow);
  });

  it("keeps a refused request through a loaded state, a crash and a refused navigation, until a load starts or fails", () => {
    const refused: PaneStatus = loaded.apply(new ViewRequestRefusalEvent(RefusedRequest.Permission, "https://one.example"));

    expect([
      refused.apply(state("https://one.example/#part", "One", false)).refusedRequest,
      refused.apply(new ViewCrashEvent()).refusedRequest,
      refused.refuse("https://refused.example").refusedRequest,
      refused.apply(state("https://two.example/", "", true)).refusedRequest,
      refused.apply(new ViewLoadFailureEvent("https://gone.example/", -2, "ERR_FAILED")).refusedRequest
    ]).toEqual([RefusedRequest.Permission, RefusedRequest.Permission, RefusedRequest.Permission, null, null]);
  });

  it("keeps a refused request that arrives during a load through that load's states and its failure, and a load that starts after it clears it", () => {
    const loading: PaneStatus = PaneStatus.empty.apply(state("https://one.example/", "", true));
    const refused: PaneStatus = loading.apply(new ViewRequestRefusalEvent(RefusedRequest.Authentication, "https://one.example"));
    const committed: PaneStatus = refused.apply(state("https://one.example/private", "Private", true));
    const stopped: PaneStatus = committed.apply(state("https://one.example/private", "Private", false));
    const failed: PaneStatus = refused.apply(new ViewLoadFailureEvent("https://one.example/", -202, "ERR_CERT_AUTHORITY_INVALID"));
    const held: PaneStatus = loading.refuseRequest(RefusedRequest.NewWindow, "https://ads.example/").apply(state("https://one.example/", "One", true));

    expect([committed.refusedRequest, stopped.refusedRequest, failed.refusedRequest, failed.state, held.refusedTarget]).toEqual([
      RefusedRequest.Authentication, RefusedRequest.Authentication, RefusedRequest.Authentication, PaneState.Failed, "https://ads.example/"
    ]);
    expect([
      stopped.apply(state("https://two.example/", "", true)).refusedRequest,
      failed.apply(state("https://two.example/", "", true)).refusedRequest,
      stopped.apply(new ViewLoadFailureEvent("https://two.example/", -2, "ERR_FAILED")).refusedRequest
    ]).toEqual([null, null, null]);
  });

  it("drops a refused request that came during a load when the person or an agent starts a navigation before that load ends", () => {
    const refused: PaneStatus = PaneStatus.empty.apply(state("https://one.example/", "", true)).refuseRequest(RefusedRequest.NewWindow, "https://ads.example/");
    const navigating: PaneStatus = refused.navigate();

    expect([navigating.refusedRequest, navigating.refusedTarget, navigating.state, navigating.url]).toEqual([null, null, PaneState.Loading, "https://one.example/"]);
    expect(navigating.apply(state("https://two.example/", "", true)).refusedRequest).toBeNull();
  });

  it("dismisses its refused request and keeps the rest, and stays the same with none", () => {
    const refused: PaneStatus = loaded.apply(new ViewRequestRefusalEvent(RefusedRequest.FileChooser, "https://one.example"));

    expect(shown(refused.dismissRequest())).toEqual(shown(loaded));
    expect(loaded.dismissRequest()).toBe(loaded);
  });

  it("offers a pop-up beside the page, in place of a refused request or a typed address's refusal, the page and its state kept", () => {
    const popup: PopupOffer = new PopupOffer("https://ads.example/", null, false);
    const offered: PaneStatus = loaded.apply(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example")).refuseAddress(TypedAddressRefusal.NotWeb).offerPopup(popup);

    expect([offered.popup, offered.refusedRequest, offered.refusedAddress, offered.state, offered.url, offered.title]).toEqual([popup, null, null, PaneState.Loaded, "https://one.example/", "One"]);
  });

  it("keeps a pop-up through a loaded state, a crash, a refused navigation and a dismissed address, until a load starts or fails or another notice takes its place", () => {
    const offered: PaneStatus = loaded.offerPopup(new PopupOffer("https://ads.example/", "https://one.example", false));

    expect([
      offered.apply(state("https://one.example/#part", "One", false)).popup?.address,
      offered.apply(new ViewCrashEvent()).popup?.address,
      offered.refuse("https://refused.example").popup?.address,
      offered.dismissAddress().popup?.address,
      offered.apply(state("https://two.example/", "", true)).popup,
      offered.apply(new ViewLoadFailureEvent("https://gone.example/", -2, "ERR_FAILED")).popup,
      offered.apply(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example")).popup,
      offered.refuseAddress(TypedAddressRefusal.Local).popup
    ]).toEqual(["https://ads.example/", "https://ads.example/", "https://ads.example/", "https://ads.example/", null, null, null, null]);
    expect(offered.dismissAddress()).toBe(offered);
  });

  it("dismisses its pop-up with the refused request's notice, and keeps the rest", () => {
    expect(shown(loaded.offerPopup(new PopupOffer("https://ads.example/", null, false)).dismissRequest())).toEqual(shown(loaded));
  });

  it("is unavailable once the host closes the view", () => {
    expect(loaded.apply(new ViewCloseEvent())).toBe(PaneStatus.unavailable);
  });

  it("keeps a typed address's refusal beside the page, in place of a refused request, the page and its state kept", () => {
    const request: PaneStatus = loaded.apply(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example"));
    const refused: PaneStatus = request.refuseAddress(TypedAddressRefusal.NotWeb);

    expect(shown(refused)).toEqual({ ...shown(loaded), refusedAddress: TypedAddressRefusal.NotWeb });
    expect(refused.refuseAddress(TypedAddressRefusal.NotWeb)).toBe(refused);
    expect(refused.refuseAddress(TypedAddressRefusal.Local).refusedAddress).toBe(TypedAddressRefusal.Local);
    expect(PaneStatus.empty.refuseAddress(TypedAddressRefusal.NotAnAddress).state).toBe(PaneState.Empty);
  });

  it("puts a typed address's refusal with an origin in place of a failed load's or a refused navigation's state, and keeps any other state, or one for text with no origin", () => {
    const failed: PaneStatus = loaded.apply(new ViewLoadFailureEvent("http://127.0.0.1:9/", -102, "ERR_CONNECTION_REFUSED"));
    const replaced: PaneStatus = failed.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1");
    const crashed: PaneStatus = loaded.apply(new ViewCrashEvent());

    expect(shown(replaced)).toEqual({ ...shown(failed), state: PaneState.Refused, failureReason: null, refusedOrigin: "http://192.168.1.1", refusedAddress: TypedAddressRefusal.Local });
    expect(replaced.dismissAddress()).toBe(failed);
    expect(replaced.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1")).toBe(replaced);
    expect([replaced.refuseAddress(TypedAddressRefusal.NeverAllowed, "http://192.168.1.1").refusedAddress, replaced.refuseAddress(TypedAddressRefusal.Local, "http://10.0.0.1").refusedOrigin])
      .toEqual([TypedAddressRefusal.NeverAllowed, "http://10.0.0.1"]);
    expect(shown(failed.refuseAddress(TypedAddressRefusal.NotAnAddress))).toEqual({ ...shown(failed), refusedAddress: TypedAddressRefusal.NotAnAddress });
    expect(shown(loaded.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1"))).toEqual({ ...shown(loaded), refusedAddress: TypedAddressRefusal.Local });
    expect(shown(crashed.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1"))).toEqual({ ...shown(crashed), refusedAddress: TypedAddressRefusal.Local });
  });

  it("puts back the state a refused address replaced when its notice is dismissed, the first one through more refusals, with no notice of its own", () => {
    const failed: PaneStatus = loaded.apply(new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED"));
    const swapped: PaneStatus = failed.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1");
    const refused: PaneStatus = loaded.refuse("https://refused.example");
    const noticed: PaneStatus = failed.refuseRequest(RefusedRequest.Download).refuseAddress(TypedAddressRefusal.NotWeb);

    expect([
      swapped.dismissAddress(),
      swapped.refuseAddress(TypedAddressRefusal.NeverAllowed, "http://10.0.0.1").dismissAddress(),
      swapped.refuseAddress(TypedAddressRefusal.NotWeb).dismissAddress(),
      swapped.apply(state("https://one.example/", "One", false, true, false)).dismissAddress(),
      refused.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1").dismissAddress()
    ]).toEqual([failed, failed, failed, failed, refused]);
    expect(swapped.refuseAddress(TypedAddressRefusal.NeverAllowed, "http://10.0.0.1").dismissAddress()).toBe(failed);
    expect(shown(noticed.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1").dismissAddress())).toEqual(shown(failed));
  });

  it("drops the state a refused address replaced on the next load, failure, refused navigation or crash", () => {
    const swapped: PaneStatus = loaded.apply(new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED"))
      .refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1");

    expect([
      swapped.apply(state("https://two.example/", "", true)).dismissAddress().state,
      swapped.apply(new ViewLoadFailureEvent("https://down.example/", -2, "ERR_FAILED")).dismissAddress().url,
      swapped.refuse("https://refused.example").dismissAddress().refusedOrigin,
      swapped.apply(new ViewCrashEvent()).dismissAddress().state
    ]).toEqual([PaneState.Loading, "https://down.example/", "https://refused.example", PaneState.Crashed]);
  });

  it("puts back the state a refused address replaced when a refused request or a pop-up takes its notice's place", () => {
    const failed: PaneStatus = loaded.apply(new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED"));
    const swapped: PaneStatus = failed.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.1");
    const popup: PopupOffer = new PopupOffer("https://ads.example/", null, false);

    expect(shown(swapped.refuseRequest(RefusedRequest.Download))).toEqual({ ...shown(failed), refusedRequest: RefusedRequest.Download });
    expect(shown(swapped.offerPopup(popup))).toEqual({ ...shown(failed), popup });
  });

  it("keeps a typed address's refusal through a loaded state and a crash, until a load starts or fails, a navigation is refused or a request takes its place", () => {
    const refused: PaneStatus = loaded.refuseAddress(TypedAddressRefusal.Credentials);

    expect([
      refused.apply(state("https://one.example/#part", "One", false)).refusedAddress,
      refused.apply(new ViewCrashEvent()).refusedAddress,
      refused.apply(state("https://two.example/", "", true)).refusedAddress,
      refused.apply(new ViewLoadFailureEvent("https://gone.example/", -2, "ERR_FAILED")).refusedAddress,
      refused.refuse("https://refused.example").refusedAddress,
      refused.apply(new ViewRefusalEvent("https://refused.example/", "https://refused.example", false)).refusedAddress
    ]).toEqual([TypedAddressRefusal.Credentials, TypedAddressRefusal.Credentials, null, null, null, null]);
    const request: PaneStatus = refused.apply(new ViewRequestRefusalEvent(RefusedRequest.NewWindow, "https://one.example"));
    expect([request.refusedRequest, request.refusedAddress]).toEqual([RefusedRequest.NewWindow, null]);
    const target: PaneStatus = request.refuseRequest(RefusedRequest.NewWindow, "https://status.example/");
    expect([target.refusedTarget, target.refuseRequest(RefusedRequest.NewWindow, "https://status.example/"), request.refuseRequest(RefusedRequest.NewWindow)])
      .toEqual(["https://status.example/", target, request]);
    expect([target.apply(new ViewCrashEvent()).refusedTarget, target.refuse("https://refused.example").refusedTarget, target.dismissRequest().refusedTarget])
      .toEqual(["https://status.example/", "https://status.example/", null]);
  });

  it("refuses the same origin again once a typed address's refusal shows, so the refusal goes", () => {
    const refused: PaneStatus = loaded.refuse("https://refused.example");

    expect(refused.refuse("https://refused.example")).toBe(refused);
    expect(refused.refuseAddress(TypedAddressRefusal.Local).refuse("https://refused.example").refusedAddress).toBeNull();
  });

  it("dismisses its typed address's refusal and keeps the rest, and stays the same with none", () => {
    expect(shown(loaded.refuseAddress(TypedAddressRefusal.TooLong).dismissAddress())).toEqual(shown(loaded));
    expect(loaded.dismissAddress()).toBe(loaded);
  });
});
