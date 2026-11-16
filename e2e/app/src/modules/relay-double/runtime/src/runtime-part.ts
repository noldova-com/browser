/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";
import { type IRuntimePart, type IRuntimePartContext, type IRuntimeWebViews, type RequestContext, WebViewFailureException } from "@noldova/desktop.runtime";

import { HeldEvent } from "./held-event.js";

export class RuntimePart implements IRuntimePart {
  private static readonly OPEN_METHOD: string = "relay-double.open";
  private static readonly VIEWS_METHOD: string = "relay-double.views";
  private static readonly ALLOW_METHOD: string = "relay-double.allow";
  private static readonly NAVIGATE_METHOD: string = "relay-double.navigate";
  private static readonly SEND_METHOD: string = "relay-double.send";
  private static readonly OPENING_EVENT: string = "relay-double.opening";
  private static readonly LISTEN_METHOD: string = "relay-double.listen";
  private static readonly ANSWERED: string = "Answered";
  private static readonly NO_VIEW: string = "The relay double has no web view open; call relay-double.open first.";

  private opening: HeldEvent | null = null;

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const views = context.webViews;
    const opening = new HeldEvent(context.declareEvent(RuntimePart.OPENING_EVENT));
    this.opening = opening;
    context.registerMethod(RuntimePart.OPEN_METHOD, { handleAsync: async () => RuntimePart.open(opening) });
    context.registerMethod(RuntimePart.LISTEN_METHOD, { handleAsync: async () => RuntimePart.listen(opening) });
    context.registerMethod(RuntimePart.VIEWS_METHOD, { handleAsync: async () => views.list().map(t => t.id) });
    context.registerMethod(RuntimePart.ALLOW_METHOD, { handleAsync: t => RuntimePart.allowAsync(views, t) });
    context.registerMethod(RuntimePart.NAVIGATE_METHOD, { handleAsync: t => RuntimePart.navigateAsync(views, t) });
    context.registerMethod(RuntimePart.SEND_METHOD, { handleAsync: t => RuntimePart.sendAsync(views, t) });
  }

  public async deactivateAsync(): Promise<void> {
    this.opening?.[Symbol.dispose]();
    this.opening = null;
  }

  private static open(opening: HeldEvent): null {
    opening.publish(null);
    return null;
  }

  private static listen(opening: HeldEvent): null {
    opening.listen();
    return null;
  }

  private static ownView(views: IRuntimeWebViews): string {
    const [view] = views.list();
    if (view === undefined)
      throw new Error(RuntimePart.NO_VIEW);
    return view.id;
  }

  private static async allowAsync(views: IRuntimeWebViews, request: RequestContext): Promise<null> {
    await views.setAllowedOriginsAsync(RuntimePart.ownView(views), JsonReader.fromValue(request.payload).readStringArray("origins"));
    return null;
  }

  private static async navigateAsync(views: IRuntimeWebViews, request: RequestContext): Promise<JsonValue> {
    const answer = await views.navigateAsync(RuntimePart.ownView(views), JsonReader.fromValue(request.payload).readString("url"));
    return answer.kind;
  }

  private static async sendAsync(views: IRuntimeWebViews, request: RequestContext): Promise<JsonValue> {
    const payload = JsonReader.fromValue(request.payload);
    const view = payload.hasField("view") ? payload.readString("view") : RuntimePart.ownView(views);
    try {
      await views.relay.sendAsync(view, payload.readString("method"), payload.readObject("params").toJson(), payload.readNumber("timeout"));
      return RuntimePart.ANSWERED;
    }
    catch (error: unknown) {
      if (error instanceof WebViewFailureException)
        return error.failure.kind;
      throw error;
    }
  }
}
