/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionRequest, type IToolCallPermissions, PermissionDecision, PermissionDetailKind, PermissionOption, PermissionOutcome, ToolAbortReason,
  ToolCall, ToolRisk } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { CallCancelledException } from "../../src/exceptions/call-cancelled.exception.ts";
import type { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { PermissionDeniedException } from "../../src/exceptions/permission-denied.exception.ts";
import { PermissionExpiredException } from "../../src/exceptions/permission-expired.exception.ts";
import { PermissionWithdrawnException } from "../../src/exceptions/permission-withdrawn.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { ToolDescriptors } from "../../src/models/tool-descriptors.ts";
import { PermissionGate } from "../../src/services/permission-gate.ts";
import { CorePermissionRequests } from "../fixtures/core-permission-requests.fixture.ts";
import { PermissionAnswers } from "../fixtures/permission-answers.fixture.ts";

const REQUEST: IPermissionRequest = {
  action: "browser.click",
  subject: "https://shop.test",
  title: "Click Pay now",
  details: [{ label: "Element", kind: PermissionDetailKind.Text, value: "Pay now" }, { label: "Origin", kind: PermissionDetailKind.Text, value: "https://shop.test" }],
  risk: ToolRisk.Medium,
  isAsking: true,
  options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
  labels: { [PermissionOption.AllowAlways]: "Allow for this chat" }
};

function checked(answers: PermissionAnswers): IToolCallPermissions {
  return new CorePermissionRequests(ToolDescriptors.click, answers, "one");
}

function call(permissions: IToolCallPermissions, signal: AbortSignal = new AbortController().signal): ToolCall {
  return new ToolCall("one", "conversation-1", {}, {}, Date.now() + 5_000, signal, permissions);
}

function answering(controller: AbortController, decision: PermissionDecision, reason?: ToolAbortReason): IToolCallPermissions {
  return { requestAsync: async (): Promise<PermissionOutcome> => {
    controller.abort(reason);
    return new PermissionOutcome(decision);
  } };
}

describe("PermissionGate", () => {
  it("lets the action through once allowed", async () => {
    for (const decision of [PermissionDecision.AllowedOnce, PermissionDecision.AllowedAlways]) {
      const permissions: PermissionAnswers = new PermissionAnswers();
      permissions.automaticDecision = decision;

      await expect(new PermissionGate().askAsync(call(checked(permissions)), REQUEST, new ActionProgress(() => undefined))).resolves.toBeUndefined();
      expect(permissions.requests).toEqual([REQUEST]);
    }
  });

  it("marks the call granted only when the action is allowed", async () => {
    const allowing: PermissionAnswers = new PermissionAnswers();
    allowing.automaticDecision = PermissionDecision.AllowedOnce;
    const denying: PermissionAnswers = new PermissionAnswers();
    denying.automaticDecision = PermissionDecision.Denied;
    const allowed: ActionProgress = new ActionProgress(() => undefined);
    const denied: ActionProgress = new ActionProgress(() => undefined);

    await new PermissionGate().askAsync(call(checked(allowing)), REQUEST, allowed);
    await expect(new PermissionGate().askAsync(call(checked(denying)), REQUEST, denied)).rejects.toThrow(PermissionDeniedException);

    expect([allowed.isGranted, denied.isGranted]).toEqual([true, false]);
  });

  it("asks the person for every risk but low, which the app's policy decides", () => {
    expect([PermissionGate.isAsking(ToolRisk.Low), PermissionGate.isAsking(ToolRisk.Medium), PermissionGate.isAsking(ToolRisk.High)]).toEqual([false, true, true]);
  });

  it("refuses the action on every other decision", async () => {
    const cases: readonly [PermissionDecision, new () => CallFailureException][] = [
      [PermissionDecision.Denied, PermissionDeniedException],
      [PermissionDecision.DeniedAlways, PermissionDeniedException],
      [PermissionDecision.Expired, PermissionExpiredException],
      [PermissionDecision.Withdrawn, PermissionWithdrawnException]
    ];
    for (const [decision, failure] of cases) {
      const permissions: IToolCallPermissions = { requestAsync: (): Promise<PermissionOutcome> => Promise.resolve(new PermissionOutcome(decision)) };

      await expect(new PermissionGate().askAsync(call(permissions), REQUEST, new ActionProgress(() => undefined)), decision).rejects.toThrow(failure);
    }
  });

  it("waits for the person's answer", async () => {
    const permissions: PermissionAnswers = new PermissionAnswers();
    const asked: Promise<void> = new PermissionGate().askAsync(call(checked(permissions)), REQUEST, new ActionProgress(() => undefined));
    await permissions.raised;
    expect(permissions.pending).toHaveLength(1);

    permissions.answerNext(PermissionDecision.Denied);

    await expect(asked).rejects.toThrow(PermissionDeniedException);
  });

  it("reports withdrawn when the call is cancelled while it waits", async () => {
    const permissions: PermissionAnswers = new PermissionAnswers();
    const controller: AbortController = new AbortController();
    const asked: Promise<void> = new PermissionGate().askAsync(call(checked(permissions), controller.signal), REQUEST, new ActionProgress(() => undefined));
    await permissions.raised;

    controller.abort(ToolAbortReason.Cancelled);

    await expect(asked).rejects.toThrow(PermissionWithdrawnException);
    expect(permissions.pending).toHaveLength(0);
  });

  it("ends a call whose session ended during the wait as withdrawn when Noldova Desktop withdraws the request", async () => {
    const controller: AbortController = new AbortController();
    const permissions: IToolCallPermissions = answering(controller, PermissionDecision.Withdrawn, ToolAbortReason.SessionEnded);

    await expect(new PermissionGate().askAsync(call(permissions, controller.signal), REQUEST, new ActionProgress(() => undefined)))
      .rejects.toThrow(PermissionWithdrawnException);
  });

  it("ends a call aborted after the request was answered by the abort's reason, with no grant and no withdrawal", async () => {
    for (const decision of [PermissionDecision.AllowedOnce, PermissionDecision.Denied, PermissionDecision.Expired]) {
      const controller: AbortController = new AbortController();
      const progress: ActionProgress = new ActionProgress(() => undefined);

      await expect(new PermissionGate().askAsync(call(answering(controller, decision), controller.signal), REQUEST, progress), decision)
        .rejects.toThrow(CallCancelledException);
      expect(progress.isGranted, decision).toBe(false);
    }
  });

  it("ends a call aborted during the wait for any other reason as withdrawn too, as Noldova Desktop's registry does", async () => {
    const progress: ActionProgress = new ActionProgress(() => undefined);
    for (const reason of [ToolAbortReason.Stopped, ToolAbortReason.SwitchedOff, ToolAbortReason.DeadlineReached]) {
      const controller: AbortController = new AbortController();

      await expect(new PermissionGate().askAsync(call(answering(controller, PermissionDecision.Withdrawn, reason), controller.signal), REQUEST, progress), reason)
        .rejects.toThrow(PermissionWithdrawnException);
    }
    expect(progress.isGranted).toBe(false);
  });

  it("ends a call the person stopped after they answered as stopped", async () => {
    const controller: AbortController = new AbortController();

    await expect(new PermissionGate().askAsync(call(answering(controller, PermissionDecision.AllowedOnce, ToolAbortReason.Stopped), controller.signal), REQUEST,
      new ActionProgress(() => undefined))).rejects.toThrow(CallStoppedException);
  });

  it("reports expired when the request expires", async () => {
    const permissions: PermissionAnswers = new PermissionAnswers();
    const asked: Promise<void> = new PermissionGate().askAsync(call(checked(permissions)), REQUEST, new ActionProgress(() => undefined));
    await permissions.raised;

    permissions.expireAll();

    await expect(asked).rejects.toThrow(PermissionExpiredException);
  });

  it("fails closed as denied when the call can't raise the request", async () => {
    const progress: ActionProgress = new ActionProgress(() => undefined);
    const unanswered: ToolCall = new ToolCall("one", "conversation-1", {}, {}, Date.now() + 5_000, new AbortController().signal);

    await expect(new PermissionGate().askAsync(unanswered, REQUEST, progress)).rejects.toThrow(PermissionDeniedException);
    expect(progress.isGranted).toBe(false);
  });
});
