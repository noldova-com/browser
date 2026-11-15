/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserToolNames } from "@noldova/browser.protocol";
import { type IPermissionRequest, type IToolCallPermissions, type IToolDescriptor, PermissionCenter, type PermissionOutcome, ToolDescriptor, ToolRegistry,
  type ToolSession } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";

import { writtenTo } from "./desktop-fakes.fixture.ts";
import { MemoryRememberedPermissions } from "./memory-remembered-permissions.fixture.ts";
import type { PermissionAnswers } from "./permission-answers.fixture.ts";

export class CorePermissionRequests implements IToolCallPermissions {
  private static readonly PERMISSIONS_MODULE: string = "permissions";
  private readonly log: FakeModuleLog = new FakeModuleLog();
  private readonly center: PermissionCenter = new PermissionCenter(CorePermissionRequests.PERMISSIONS_MODULE);
  private readonly descriptor: ToolDescriptor;
  private readonly session: ToolSession;

  public constructor(descriptor: IToolDescriptor, answers: PermissionAnswers, session: string) {
    this.descriptor = new ToolDescriptor(descriptor, BrowserToolNames.all);
    this.session = new ToolRegistry(() => session).openSession("conversation-1", {});
    this.center.open(new MemoryRememberedPermissions());
    this.center.registerAnswerer(CorePermissionRequests.PERMISSIONS_MODULE, answers, this.log);
  }

  public get name(): string {
    return this.descriptor.name;
  }

  public get messages(): readonly string[] {
    return writtenTo(this.log);
  }

  public requestAsync(request: IPermissionRequest, signal: AbortSignal): Promise<PermissionOutcome> {
    return this.center.requestAsync("browser", this.descriptor, this.log, this.session, request, signal);
  }
}
