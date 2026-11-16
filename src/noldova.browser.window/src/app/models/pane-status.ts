/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
    holdsRefusedLoad: boolean = false) {
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
  }

  public apply(event: ViewEvent): PaneStatus {
    return event.applyTo(this);
  }

  public show(state: ViewStateEvent): PaneStatus {
    if (state.isLoading && this.holdsRefusedLoad && state.address === this.url)
      return new PaneStatus(PaneState.Refused, this.url, this.title, state.canGoBack, state.canGoForward, null, this.refusedOrigin, this.refusedRequest, this.refusedTarget, null,
        this.popup);
    if (state.isLoading)
      return new PaneStatus(PaneState.Loading, state.address, state.title, state.canGoBack, state.canGoForward, null, null, this.loadRequest(), this.loadTarget(), null, null);
    return new PaneStatus(this.state === PaneState.Loading ? PaneState.Loaded : this.state, state.address, state.title, state.canGoBack, state.canGoForward, this.failureReason,
      this.refusedOrigin, this.refusedRequest, this.refusedTarget, this.refusedAddress, this.popup, this.replaced);
  }

  public fail(failure: ViewLoadFailureEvent): PaneStatus {
    return new PaneStatus(PaneState.Failed, failure.address, this.title, this.canGoBack, this.canGoForward, failure.description, null, this.loadRequest(), this.loadTarget(), null, null);
  }

  public crash(): PaneStatus {
    return new PaneStatus(PaneState.Crashed, this.url, this.title, this.canGoBack, this.canGoForward, null, null, this.refusedRequest, this.refusedTarget, this.refusedAddress, this.popup);
  }

  public refuse(origin: string, holdsRefusedLoad: boolean = false): PaneStatus {
    return this.state === PaneState.Refused && this.refusedOrigin === origin && this.refusedAddress === null && this.holdsRefusedLoad === holdsRefusedLoad
      ? this
      : new PaneStatus(PaneState.Refused, this.url, this.title, this.canGoBack, this.canGoForward, null, origin, this.refusedRequest, this.refusedTarget, null, this.popup,
        null, holdsRefusedLoad);
  }

  public navigate(): PaneStatus {
    return this.holdsRefusedLoad || this.refusedRequest !== null
      ? new PaneStatus(this.state, this.url, this.title, this.canGoBack, this.canGoForward, this.failureReason, this.refusedOrigin, null, null, this.refusedAddress, this.popup,
        this.replaced)
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
        this.replaced);
  }

  public dismissRequest(): PaneStatus {
    return this.refusedRequest === null && this.popup === null
      ? this
      : new PaneStatus(this.state, this.url, this.title, this.canGoBack, this.canGoForward, this.failureReason, this.refusedOrigin, null, null, this.refusedAddress, null,
        this.replaced);
  }

  public dismissAddress(): PaneStatus {
    if (this.replaced !== null)
      return this.replaced.dismissAddress().dismissRequest();
    return this.refusedAddress === null
      ? this
      : new PaneStatus(this.state, this.url, this.title, this.canGoBack, this.canGoForward, this.failureReason, this.refusedOrigin, this.refusedRequest, this.refusedTarget, null,
        this.popup);
  }

  public refuseRequest(request: RefusedRequest, target: string | null = null): PaneStatus {
    const base: PaneStatus = this.replaced ?? this;
    return this.refusedRequest === request && this.refusedTarget === target
      ? this
      : new PaneStatus(base.state, base.url, base.title, base.canGoBack, base.canGoForward, base.failureReason, base.refusedOrigin, request, target, null, null);
  }

  public offerPopup(popup: PopupOffer): PaneStatus {
    const base: PaneStatus = this.replaced ?? this;
    return new PaneStatus(base.state, base.url, base.title, base.canGoBack, base.canGoForward, base.failureReason, base.refusedOrigin, null, null, null, popup);
  }

  private loadRequest(): RefusedRequest | null {
    return this.state === PaneState.Loading ? this.refusedRequest : null;
  }

  private loadTarget(): string | null {
    return this.state === PaneState.Loading ? this.refusedTarget : null;
  }
}
