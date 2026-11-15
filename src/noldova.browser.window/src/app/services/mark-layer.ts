/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageActivity } from "@noldova/browser.protocol";
import type { IWebViewHandle, IWebViewLayer } from "@noldova/desktop.window";

import type { AgentMarkComponent } from "../components/agent-mark/agent-mark.component.ts";

export class MarkLayer {
  private layer: IWebViewLayer<AgentMarkComponent> | null = null;
  private activity: PageActivity;
  private zoom: number;
  private isClosed: boolean = false;

  private constructor(activity: PageActivity, zoom: number) {
    this.activity = activity;
    this.zoom = zoom;
  }

  public static open(view: IWebViewHandle, activity: PageActivity, zoom: number, fail: (error: unknown) => void): MarkLayer {
    const mark: MarkLayer = new MarkLayer(activity, zoom);
    mark.openAsync(view).catch((error: unknown) => {
      if (!view.isClosed)
        fail(error);
    });
    return mark;
  }

  public update(activity: PageActivity, zoom: number): void {
    this.activity = activity;
    this.zoom = zoom;
    this.layer?.componentRef.setInput("activity", activity);
    this.layer?.componentRef.setInput("zoom", zoom);
  }

  public close(): void {
    this.isClosed = true;
    this.layer?.close();
    this.layer = null;
  }

  private async openAsync(view: IWebViewHandle): Promise<void> {
    const layer: IWebViewLayer<AgentMarkComponent> =
      await view.openLayerAsync(() => import("../components/agent-mark/agent-mark.component.ts").then(t => t.AgentMarkComponent));
    if (this.isClosed) {
      layer.close();
      return;
    }
    this.layer = layer;
    layer.componentRef.setInput("activity", this.activity);
    layer.componentRef.setInput("zoom", this.zoom);
    void layer.closed.then(() => {
      if (this.layer === layer)
        this.layer = null;
    });
  }
}
