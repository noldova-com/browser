/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionRequest, PermissionDecision, type PermissionOutcome, type ToolCall, ToolRisk } from "@noldova/desktop.runtime";

import type { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { PermissionWithdrawnException } from "../exceptions/permission-withdrawn.exception.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { ToolFailures } from "./tool-failures.ts";

export class PermissionGate {
  public static isAsking(risk: ToolRisk): boolean {
    return risk !== ToolRisk.Low;
  }

  public async askAsync(call: ToolCall, request: IPermissionRequest, progress: ActionProgress): Promise<void> {
    const outcome: PermissionOutcome = await call.requestPermissionAsync(request);
    if (call.signal.aborted)
      throw outcome.decision === PermissionDecision.Withdrawn ? new PermissionWithdrawnException() : ToolFailures.fromAbort(call.signal.reason);
    const refusal: CallFailureException | null = ToolFailures.fromDecision(outcome.decision);
    if (refusal !== null)
      throw refusal;
    progress.markGranted();
  }
}
