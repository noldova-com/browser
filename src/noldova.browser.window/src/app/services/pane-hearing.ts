/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ViewEvent } from "../models/view-event.ts";
import type { ViewKeyEvent } from "../models/view-key-event.ts";
import type { ViewLoadFailureEvent } from "../models/view-load-failure-event.ts";
import type { ViewNewWindowEvent } from "../models/view-new-window-event.ts";
import type { ViewRefusalEvent } from "../models/view-refusal-event.ts";
import type { ViewStateEvent } from "../models/view-state-event.ts";

export class PaneHearing {
  private readonly changeStatus: (event: ViewEvent) => void;
  private readonly newWindowListeners: Set<(event: ViewNewWindowEvent) => void> = new Set<(event: ViewNewWindowEvent) => void>();
  private readonly redirectListeners: Set<(event: ViewRefusalEvent) => boolean> = new Set<(event: ViewRefusalEvent) => boolean>();
  private readonly keyListeners: Set<(event: ViewKeyEvent) => void> = new Set<(event: ViewKeyEvent) => void>();
  private readonly zoomListeners: Set<(factor: number) => void> = new Set<(factor: number) => void>();
  private cancelled: string | null = null;
  private factor: number = 1;

  public constructor(changeStatus: (event: ViewEvent) => void) {
    this.changeStatus = changeStatus;
  }

  public get zoom(): number {
    return this.factor;
  }

  public onNewWindow(listener: (event: ViewNewWindowEvent) => void): () => void {
    this.newWindowListeners.add(listener);
    return () => this.newWindowListeners.delete(listener);
  }

  public onKey(listener: (event: ViewKeyEvent) => void): () => void {
    this.keyListeners.add(listener);
    return () => this.keyListeners.delete(listener);
  }

  public onZoom(listener: (factor: number) => void): () => void {
    this.zoomListeners.add(listener);
    return () => this.zoomListeners.delete(listener);
  }

  public onRefusedRedirect(listener: (event: ViewRefusalEvent) => boolean): () => void {
    this.redirectListeners.add(listener);
    return () => this.redirectListeners.delete(listener);
  }

  public change(event: ViewEvent): void {
    this.changeStatus(event);
  }

  public openWindow(event: ViewNewWindowEvent): void {
    for (const listener of [...this.newWindowListeners])
      listener(event);
  }

  public pressKey(event: ViewKeyEvent): void {
    for (const listener of [...this.keyListeners])
      listener(event);
  }

  public zoomTo(factor: number): number {
    if (factor !== this.factor) {
      this.factor = factor;
      for (const listener of [...this.zoomListeners])
        listener(factor);
    }
    return factor;
  }

  public refuse(event: ViewRefusalEvent): void {
    this.cancelled = event.origin;
    if (!event.isRedirect || ![...this.redirectListeners].some(t => t(event)))
      this.changeStatus(event);
  }

  public fail(event: ViewLoadFailureEvent): void {
    if (this.cancelled !== null && URL.parse(event.address)?.origin === this.cancelled)
      this.cancelled = null;
    else
      this.changeStatus(event);
  }

  public show(event: ViewStateEvent): void {
    if (!event.isLoading)
      this.cancelled = null;
    this.changeStatus(event);
  }

  public clear(): void {
    this.newWindowListeners.clear();
    this.redirectListeners.clear();
    this.keyListeners.clear();
    this.zoomListeners.clear();
  }
}
