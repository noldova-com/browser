/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import type { AddressRefusal } from "../enums/address-refusal.ts";
import { PaneState } from "../enums/pane-state.ts";
import type { RefusedRequest } from "../enums/refused-request.ts";
import type { PopupOffer } from "./popup-offer.ts";
import type { ViewEvent } from "./view-event.ts";
import type { ViewLoadFailureEvent } from "./view-load-failure-event.ts";
import type { ViewStateEvent } from "./view-state-event.ts";

export class PaneStatus {
  public static readonly empty: PaneStatus = new PaneStatus(PaneState.Empty, "", "", false, false, null, null, null, null, null, null);
  public static readonly unavailable: PaneStatus = new PaneStatus(PaneState.Unavailable, "", "", false, false, null, null, null, null, null, null);

  private static readonly NAMING_STATES: readonly PaneState[] = [PaneState.Failed, PaneState.Refused];
  private readonly replaced: PaneStatus | null;
  private readonly holdsRefusedLoad: boolean;

  public readonly state: PaneState;
  public readonly url: string;
  public readonly title: string;
  public readonly canGoBack: boolean;
  public readonly canGoForward: boolean;
  public readonly failureReason: string | null;
  public readonly refusedOrigin: string | null;
  public readonly refusedRequest: RefusedRequest | null;
  public readonly refusedTarget: string | null;
  public readonly refusedAddress: AddressRefusal | null;
  public readonly popup: PopupOffer | null;
  public readonly isPageRefusal: boolean;

  private constructor(
    state: PaneState,
    url: string,
    title: string,
    canGoBack: boolean,
    canGoForward: boolean,
    failureReason: string | null,
    refusedOrigin: string | null,
    refusedRequest: RefusedRequest | null,
    refusedTarget: string | null,
    refusedAddress: AddressRefusal | null,
    popup: PopupOffer | null,
    replaced: PaneStatus | null = null,
    holdsRefusedLoad: boolean = false,
    isPageRefusal: boolean = false) {
    this.state = state;
    this.url = url;
    this.title = title;
    this.canGoBack = canGoBack;
    this.canGoForward = canGoForward;
    this.failureReason = failureReason;
    this.refusedOrigin = refusedOrigin;
    this.refusedRequest = refusedRequest;
    this.refusedTarget = refusedTarget;
    this.refusedAddress = refusedAddress;
    this.popup = popup;
    this.replaced = replaced;
    this.holdsRefusedLoad = holdsRefusedLoad;
    this.isPageRefusal = isPageRefusal;
  }

  public apply(event: ViewEvent): PaneStatus {
    return event.applyTo(this);
  }

  // Noldova Desktop starts each new view at about:blank, titled with that address, and the window part may hear that start or not, so
  // about:blank is no address, and its title no title, whichever comes first.
  public show(state: ViewStateEvent): PaneStatus {
    const isBlank: boolean = state.address === Resources.blankPage;
    const address: string = isBlank ? "" : state.address;
    const title: string = isBlank && state.title === state.address ? "" : state.title;
    if (state.isLoading && this.holdsRefusedLoad && address === this.url)
      return new PaneStatus(PaneState.Refused, this.url, this.title, state.canGoBack, state.canGoForward, null, this.refusedOrigin, this.refusedRequest, this.refusedTarget, null,
        this.popup, null, false, this.isPageRefusal);
    if (state.isLoading)
      return new PaneStatus(PaneState.Loading, address, title, state.canGoBack, state.canGoForward, null, null, this.loadRequest(), this.loadTarget(), null, null);
    return new PaneStatus(this.state === PaneState.Loading ? PaneState.Loaded : this.state, address, title, state.canGoBack, state.canGoForward, this.failureReason,
      this.refusedOrigin, this.refusedRequest, this.refusedTarget, this.refusedAddress, this.popup, this.replaced, false, this.isPageRefusal);
  }

  public fail(failure: ViewLoadFailureEvent): PaneStatus {
    return new PaneStatus(PaneState.Failed, failure.address, this.title, this.canGoBack, this.canGoForward, failure.description, null, this.loadRequest(), this.loadTarget(), null, null);
  }

  public crash(): PaneStatus {
    return new PaneStatus(PaneState.Crashed, this.url, this.title, this.canGoBack, this.canGoForward, null, null, this.refusedRequest, this.refusedTarget, this.refusedAddress, this.popup);
  }

  // An opaque origin, such as about:srcdoc's, names nothing a person could recognize, so the refusal names the address instead.
  public refuse(origin: string, holdsRefusedLoad: boolean = false, address: string | null = null, isPageRefusal: boolean = false): PaneStatus {
    const named: string = origin === Resources.opaqueOrigin && address !== null ? address : origin;
    return this.state === PaneState.Refused && this.refusedOrigin === named && this.refusedAddress === null && this.holdsRefusedLoad === holdsRefusedLoad
      && this.isPageRefusal === isPageRefusal
      ? this
      : new PaneStatus(PaneState.Refused, this.url, this.title, this.canGoBack, this.canGoForward, null, named, this.refusedRequest, this.refusedTarget, null, this.popup,
        null, holdsRefusedLoad, isPageRefusal);
  }

  public navigate(): PaneStatus {
    return this.holdsRefusedLoad || this.refusedRequest !== null
      ? new PaneStatus(this.state, this.url, this.title, this.canGoBack, this.canGoForward, this.failureReason, this.refusedOrigin, null, null, this.refusedAddress, this.popup,
        this.replaced, false, this.isPageRefusal)
      : this;
  }

  public refuseAddress(reason: AddressRefusal, origin: string | null = null): PaneStatus {
    if (origin !== null && PaneStatus.NAMING_STATES.includes(this.state))
      return this.state === PaneState.Refused && this.refusedOrigin === origin && this.refusedAddress === reason
        ? this
        : new PaneStatus(PaneState.Refused, this.url, this.title, this.canGoBack, this.canGoForward, null, origin, null, null, reason, null, this.replaced ?? this);
    return this.refusedAddress === reason
      ? this
      : new PaneStatus(this.state, this.url, this.title, this.canGoBack, this.canGoForward, this.failureReason, this.refusedOrigin, null, null, reason, null,
        this.replaced, false, this.isPageRefusal);
  }

  public dismissRequest(): PaneStatus {
    return this.refusedRequest === null && this.popup === null
      ? this
      : new PaneStatus(this.state, this.url, this.title, this.canGoBack, this.canGoForward, this.failureReason, this.refusedOrigin, null, null, this.refusedAddress, null,
        this.replaced, false, this.isPageRefusal);
  }

  public dismissAddress(): PaneStatus {
    if (this.replaced !== null)
      return this.replaced.dismissAddress().dismissRequest();
    return this.refusedAddress === null
      ? this
      : new PaneStatus(this.state, this.url, this.title, this.canGoBack, this.canGoForward, this.failureReason, this.refusedOrigin, this.refusedRequest, this.refusedTarget, null,
        this.popup, null, false, this.isPageRefusal);
  }

  public refuseRequest(request: RefusedRequest, target: string | null = null): PaneStatus {
    const base: PaneStatus = this.replaced ?? this;
    return this.refusedRequest === request && this.refusedTarget === target
      ? this
      : new PaneStatus(base.state, base.url, base.title, base.canGoBack, base.canGoForward, base.failureReason, base.refusedOrigin, request, target, null, null,
        null, false, base.isPageRefusal);
  }

  public offerPopup(popup: PopupOffer): PaneStatus {
    const base: PaneStatus = this.replaced ?? this;
    return new PaneStatus(base.state, base.url, base.title, base.canGoBack, base.canGoForward, base.failureReason, base.refusedOrigin, null, null, null, popup,
      null, false, base.isPageRefusal);
  }

  private loadRequest(): RefusedRequest | null {
    return this.state === PaneState.Loading ? this.refusedRequest : null;
  }

  private loadTarget(): string | null {
    return this.state === PaneState.Loading ? this.refusedTarget : null;
  }
}
