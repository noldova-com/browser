/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import type { IRuntimePart, IRuntimePartContext, IToolEndpoint, IToolsContext, Registration, RequestContext, ToolSession } from "@noldova/desktop.runtime";

import { HeldEvent } from "./held-event.js";
import { PlannedAnswers } from "./planned-answers.js";
import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  private readonly answers: PlannedAnswers = new PlannedAnswers();
  private answerer: Registration | null = null;
  private session: ToolSession | null = null;
  private bindings: string = "";
  private opening: HeldEvent | null = null;
  private endpoint: IToolEndpoint | null = null;

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    this.answerer = context.permissions.registerAnswerer(this.answers);
    context.registerMethod(Resources.callToolMethod, { handleAsync: t => this.callToolAsync(context.tools, t) });
    context.registerMethod(Resources.listToolsMethod, { handleAsync: async () => this.openSession(context.tools, null).listTools().map(t => t.name) });
    context.registerMethod(Resources.planAnswerMethod, { handleAsync: async t => this.planAnswer(t) });
    context.registerMethod(Resources.takeQuestionsMethod, { handleAsync: async () => this.answers.takeAsked().map(t => t.toJson()) });
    context.registerMethod(Resources.endSessionMethod, { handleAsync: async () => this.endSession() });
    const opening = new HeldEvent(context.declareEvent(Resources.pageOpeningEvent));
    this.opening = opening;
    context.registerMethod(Resources.openPageMethod, { handleAsync: async t => RuntimePart.openPage(opening, t) });
    context.registerMethod(Resources.listenMethod, { handleAsync: async () => RuntimePart.listen(opening) });
    context.registerMethod(Resources.openToolEndpointMethod, { handleAsync: () => this.openEndpointAsync(context.tools) });
  }

  public async deactivateAsync(): Promise<void> {
    this.endSession();
    this.answerer?.[Symbol.dispose]();
    this.answerer = null;
    this.opening?.[Symbol.dispose]();
    this.opening = null;
    this.endpoint?.[Symbol.dispose]();
    this.endpoint = null;
  }

  private async callToolAsync(tools: IToolsContext, request: RequestContext): Promise<JsonValue> {
    const payload = JsonReader.fromValue(request.payload);
    const bindings: JsonObject | null = payload.hasField(Resources.bindingsField) ? payload.readObject(Resources.bindingsField).toJson() : null;
    const result = await this.openSession(tools, bindings).callAsync(payload.readString(Resources.nameField), payload.readObject(Resources.inputField).toJson(), { signal: request.signal });
    return result.toJson();
  }

  // A tool endpoint on loopback, as an app opens one for its agents, so a test can name its port; it answers every request
  // that passes the endpoint's checks with no content.
  private async openEndpointAsync(tools: IToolsContext): Promise<string> {
    this.endpoint ??= await tools.openEndpointAsync({ handleAsync: RuntimePart.answerEmptyAsync });
    return this.endpoint.url;
  }

  private static async answerEmptyAsync(request: IncomingMessage, response: ServerResponse): Promise<void> {
    request.resume();
    response.writeHead(204).end();
  }

  private static openPage(opening: HeldEvent, request: RequestContext): null {
    opening.publish(request.payload);
    return null;
  }

  private static listen(opening: HeldEvent): null {
    opening.listen();
    return null;
  }

  private planAnswer(request: RequestContext): null {
    const payload = JsonReader.fromValue(request.payload);
    this.answers.plan(payload.readString(Resources.actionField), payload.readString(Resources.answerField));
    return null;
  }

  private endSession(): null {
    this.session?.end();
    this.session = null;
    return null;
  }

  private openSession(tools: IToolsContext, bindings: JsonObject | null): ToolSession {
    if (!Object.isNull(bindings) && JSON.stringify(bindings) !== this.bindings)
      this.endSession();
    if (Object.isNull(this.session)) {
      this.session = tools.openSession(Resources.sessionScope, bindings ?? {});
      this.bindings = JSON.stringify(bindings ?? {});
    }
    return this.session;
  }
}
