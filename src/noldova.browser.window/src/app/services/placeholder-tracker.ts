/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewHandle } from "@noldova/desktop.window";

export class PlaceholderTracker {
  private readonly view: IWebViewHandle;
  private isDisposed: boolean = false;
  private isShown: boolean = false;

  public constructor(element: HTMLElement, view: IWebViewHandle) {
    this.view = view;
    view.mount(element);
  }

  public place(isShown: boolean): void {
    if (this.isDisposed || isShown === this.isShown)
      return;
    this.isShown = isShown;
    if (isShown)
      this.view.show();
    else
      this.view.hide();
  }

  public dispose(): void {
    if (this.isDisposed)
      return;
    this.isDisposed = true;
    if (this.isShown)
      this.view.hide();
  }
}
