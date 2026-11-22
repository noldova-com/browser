/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { RefusedRequest } from "../../../src/app/enums/refused-request.ts";
import type { ViewEvent } from "../../../src/app/models/view-event.ts";
import { ViewKeyEvent } from "../../../src/app/models/view-key-event.ts";
import { ViewLoadFailureEvent } from "../../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../../src/app/models/view-new-window-event.ts";
import { ViewRefusalEvent } from "../../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("PaneHearing", () => {
  const REFUSED: ViewRefusalEvent = new ViewRefusalEvent("https://refused.example/", "https://refused.example", false);
  const REFUSED_REDIRECT: ViewRefusalEvent = new ViewRefusalEvent("https://refused.example/", "https://refused.example", true);
  const FAILED_REFUSED: ViewLoadFailureEvent = new ViewLoadFailureEvent("https://refused.example/a", -3, "ERR_ABORTED");
  const FAILED_OTHER: ViewLoadFailureEvent = new ViewLoadFailureEvent("https://other.example/", -105, "ERR_NAME_NOT_RESOLVED");

  let changes: ViewEvent[];
  let hearing: PaneHearing;

  beforeEach(() => {
    changes = [];
    hearing = new PaneHearing(t => changes.push(t));
  });

  it("changes the status by each event it is given to change", () => {
    const event: ViewRequestRefusalEvent = new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example");

    hearing.change(event);

    expect(changes).toStrictEqual([event]);
  });

  it("tells each new-window and key listener of its event, in order, until it stops listening, without a change of status", () => {
    const heard: string[] = [];
    const stopWindows: () => void = hearing.onNewWindow(t => heard.push(`window ${t.address}`));
    hearing.onNewWindow(t => heard.push(`second ${t.address}`));
    const stopKeys: () => void = hearing.onKey(t => heard.push(`key ${t.name}`));

    hearing.openWindow(new ViewNewWindowEvent("https://two.example/", true, null));
    hearing.pressKey(new ViewKeyEvent("reload"));
    stopWindows();
    stopKeys();
    hearing.openWindow(new ViewNewWindowEvent("https://three.example/", true, null));
    hearing.pressKey(new ViewKeyEvent("newPage"));

    expect([heard, changes]).toStrictEqual([["window https://two.example/", "second https://two.example/", "key reload", "second https://three.example/"], []]);
  });

  it("keeps the view's zoom from 1 and tells the zoom listeners of each change once, until they stop listening", () => {
    const factors: number[] = [];
    const stop: () => void = hearing.onZoom(t => factors.push(t));

    const answers: number[] = [hearing.zoomTo(1), hearing.zoomTo(1.25), hearing.zoomTo(1.25)];
    stop();
    hearing.zoomTo(0.5);

    expect([answers, factors, hearing.zoom]).toStrictEqual([[1, 1.25, 1.25], [1.25], 0.5]);
  });

  it("asks the redirect listeners first about a refused redirect, and changes the status only when none takes it on", () => {
    const asked: ViewRefusalEvent[] = [];
    let takesOn: boolean = true;
    hearing.onRefusedRedirect(t => {
      asked.push(t);
      return takesOn;
    });

    hearing.refuse(REFUSED_REDIRECT);
    takesOn = false;
    hearing.refuse(REFUSED_REDIRECT);
    hearing.refuse(REFUSED);

    expect([asked, changes]).toStrictEqual([[REFUSED_REDIRECT, REFUSED_REDIRECT], [REFUSED_REDIRECT, REFUSED]]);
  });

  it("doesn't show the failed load of the origin it last heard refused, once, and shows any other failed load", () => {
    const unreadable: ViewLoadFailureEvent = new ViewLoadFailureEvent("not an address", -300, "ERR_INVALID_URL");

    hearing.fail(FAILED_REFUSED);
    hearing.refuse(REFUSED);
    hearing.fail(FAILED_OTHER);
    hearing.fail(unreadable);
    hearing.fail(FAILED_REFUSED);
    hearing.fail(FAILED_REFUSED);

    expect(changes).toStrictEqual([FAILED_REFUSED, REFUSED, FAILED_OTHER, unreadable, FAILED_REFUSED]);
  });

  it("changes the status by each state, and ends the refusal's hold on its failed load once a state stops loading, not while one loads", () => {
    const loading: ViewStateEvent = new ViewStateEvent("https://one.example/", "", true, false, false);
    const loaded: ViewStateEvent = new ViewStateEvent("https://one.example/", "One", false, false, false);

    hearing.refuse(REFUSED);
    hearing.show(loading);
    hearing.fail(FAILED_REFUSED);
    hearing.refuse(REFUSED);
    hearing.show(loaded);
    hearing.fail(FAILED_REFUSED);

    expect(changes).toStrictEqual([REFUSED, loading, REFUSED, loaded, FAILED_REFUSED]);
  });

  it("keeps the page's icon from none and tells the icon listeners of each change once, until they stop listening", () => {
    const icon: string = "data:image/png;base64,iVBORw0KGgo=";
    const images: (string | null)[] = [];
    const stop: () => void = hearing.onFavicon(t => images.push(t));
    const first: string | null = hearing.favicon;

    for (const image of [null, icon, icon, null])
      hearing.showFavicon(image);
    stop();
    hearing.showFavicon(icon);

    expect([first, images, hearing.favicon]).toStrictEqual([null, [icon, null], icon]);
  });

  it("stops every listener at clear", () => {
    const heard: string[] = [];
    hearing.onNewWindow(() => heard.push("window"));
    hearing.onKey(() => heard.push("key"));
    hearing.onZoom(() => heard.push("zoom"));
    hearing.onFavicon(() => heard.push("favicon"));
    hearing.onRefusedRedirect(() => {
      heard.push("redirect");
      return true;
    });

    hearing.clear();
    hearing.openWindow(new ViewNewWindowEvent("https://two.example/", true, null));
    hearing.pressKey(new ViewKeyEvent("reload"));
    hearing.zoomTo(2);
    hearing.showFavicon("data:image/png;base64,iVBORw0KGgo=");
    hearing.refuse(REFUSED_REDIRECT);

    expect(heard).toStrictEqual([]);
  });
});
