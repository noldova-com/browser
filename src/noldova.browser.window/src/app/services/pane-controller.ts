/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewNavigationKind, type WebViewNavigation } from "@noldova/desktop.protocol";
import type { IWebViewFound, IWebViewHandle } from "@noldova/desktop.window";

import type { AddressRefusal } from "../enums/address-refusal.ts";
import { PaneState } from "../enums/pane-state.ts";
import type { RefusedRequest } from "../enums/refused-request.ts";
import { PaneUnavailableException } from "../exceptions/pane-unavailable.exception.ts";
import { PaneStatus } from "../models/pane-status.ts";
import { PopupOffer } from "../models/popup-offer.ts";
import type { ViewEvent } from "../models/view-event.ts";
import type { ViewKeyEvent } from "../models/view-key-event.ts";
import type { ViewNewWindowEvent } from "../models/view-new-window-event.ts";
import type { ViewRefusalEvent } from "../models/view-refusal-event.ts";
import { PaneHearing } from "./pane-hearing.ts";
import { WebViewEventReader } from "./web-view-event-reader.ts";

export class PaneController {
  private readonly view: IWebViewHandle | null;
  private readonly listeners: Set<(status: PaneStatus) => void> = new Set<(status: PaneStatus) => void>();
  private readonly hearing: PaneHearing;
  private readonly unsubscribe: () => void;
  private current: PaneStatus;
  private isClosed: boolean = false;

  public constructor(view: IWebViewHandle | null) {
    this.view = view;
    this.current = view === null ? PaneStatus.unavailable : PaneStatus.empty;
    this.hearing = new PaneHearing(t => this.update(this.current.apply(t)));
    this.unsubscribe = view === null ? () => undefined : view.subscribe(t => this.follow(WebViewEventReader.read(t)));
  }

  public get status(): PaneStatus {
    return this.current;
  }

  public get zoom(): number {
    return this.hearing.zoom;
  }

  public onChange(listener: (status: PaneStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onNewWindow(listener: (event: ViewNewWindowEvent) => void): () => void {
    return this.hearing.onNewWindow(listener);
  }

  public onKey(listener: (event: ViewKeyEvent) => void): () => void {
    return this.hearing.onKey(listener);
  }

  public onZoom(listener: (factor: number) => void): () => void {
    return this.hearing.onZoom(listener);
  }

  public onRefusedRedirect(listener: (event: ViewRefusalEvent) => boolean): () => void {
    return this.hearing.onRefusedRedirect(listener);
  }

  public followNavigation(): void {
    if (!this.isClosed && this.current !== PaneStatus.unavailable)
      this.update(this.current.navigate());
  }

  public refuseNavigation(origin: string, address: string | null = null): void {
    if (!this.isClosed && this.current !== PaneStatus.unavailable)
      this.update(this.current.refuse(origin, false, address));
  }

  public async navigateAsync(url: string): Promise<WebViewNavigation> {
    return this.followAnswer(await this.startNavigation().navigateAsync(url), url);
  }

  // The history entry back or forward goes to isn't known here, so a refusal of one names its origin alone.
  public async goBackAsync(): Promise<WebViewNavigation> {
    return this.followAnswer(await this.startNavigation().goBackAsync(), null);
  }

  public async goForwardAsync(): Promise<WebViewNavigation> {
    return this.followAnswer(await this.startNavigation().goForwardAsync(), null);
  }

  // Noldova Desktop brings a crashed page back only by a navigation, and answers its reload with no history, so a crashed page loads its
  // address again.
  public async reloadAsync(): Promise<WebViewNavigation> {
    const address: string = this.current.url;
    if (this.current.state === PaneState.Crashed && address !== "")
      return this.navigateAsync(address);
    return this.followAnswer(await this.startNavigation().reloadAsync(), address);
  }

  public async stopAsync(): Promise<WebViewNavigation> {
    return this.followAnswer(await this.requireView().stopAsync(), null);
  }

  public async zoomInAsync(): Promise<number> {
    return this.hearing.zoomTo(await this.requireView().zoomInAsync());
  }

  public async zoomOutAsync(): Promise<number> {
    return this.hearing.zoomTo(await this.requireView().zoomOutAsync());
  }

  public async resetZoomAsync(): Promise<number> {
    return this.hearing.zoomTo(await this.requireView().setZoomAsync(1));
  }

  public async findAsync(text: string): Promise<IWebViewFound> {
    return this.requireView().findAsync(text);
  }

  public async findNextAsync(): Promise<IWebViewFound> {
    return this.requireView().findNextAsync();
  }

  public async findPreviousAsync(): Promise<IWebViewFound> {
    return this.requireView().findPreviousAsync();
  }

  public endFind(): void {
    if (this.view !== null && !this.isClosed)
      this.view.endFind();
  }

  public dismissRequest(): void {
    this.update(this.current.dismissRequest());
  }

  public refuseAddress(reason: AddressRefusal, origin: string | null = null): void {
    if (!this.isClosed && this.current !== PaneStatus.unavailable)
      this.update(this.current.refuseAddress(reason, origin));
  }

  public offerPopup(address: string, origin: string | null, hadRecentInput: boolean = false): void {
    if (!this.isClosed && this.current !== PaneStatus.unavailable)
      this.update(this.current.offerPopup(new PopupOffer(address, origin, hadRecentInput)));
  }

  public refuseRequest(request: RefusedRequest, target: string | null = null): void {
    if (!this.isClosed && this.current !== PaneStatus.unavailable)
      this.update(this.current.refuseRequest(request, target));
  }

  public dismissAddress(): void {
    this.update(this.current.dismissAddress());
  }

  public close(): void {
    if (this.isClosed)
      return;
    this.isClosed = true;
    this.unsubscribe();
    this.listeners.clear();
    this.hearing.clear();
    this.view?.close();
  }

  private follow(event: ViewEvent | null): void {
    if (event !== null)
      event.followIn(this.hearing);
  }

  private followAnswer(answer: WebViewNavigation, address: string | null): WebViewNavigation {
    if (answer.kind === WebViewNavigationKind.Refused && answer.origin !== null && !this.isClosed)
      this.update(this.current.refuse(answer.origin, false, address));
    return answer;
  }

  private startNavigation(): IWebViewHandle {
    const view: IWebViewHandle = this.requireView();
    this.followNavigation();
    return view;
  }

  private requireView(): IWebViewHandle {
    if (this.view === null || this.isClosed || this.current === PaneStatus.unavailable)
      throw new PaneUnavailableException();
    return this.view;
  }

  private update(status: PaneStatus): void {
    if (status === this.current)
      return;
    this.current = status;
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners])
      listener(this.current);
  }
}
