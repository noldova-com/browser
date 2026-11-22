/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { WebViewFailure, WebViewFailureKind, WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";
import { PermissionDecision, ToolAbortReason, ToolFailure, ToolFailureCode, WebViewFailureException } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { CallCancelledException } from "../../src/exceptions/call-cancelled.exception.ts";
import { CallDeadlineReachedException } from "../../src/exceptions/call-deadline-reached.exception.ts";
import type { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { CallRefusedException } from "../../src/exceptions/call-refused.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { HandedOverException } from "../../src/exceptions/handed-over.exception.ts";
import { InternalFailureException } from "../../src/exceptions/internal-failure.exception.ts";
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ModuleSwitchedOffException } from "../../src/exceptions/module-switched-off.exception.ts";
import { NavigationRefusedException } from "../../src/exceptions/navigation-refused.exception.ts";
import { NoHistoryException } from "../../src/exceptions/no-history.exception.ts";
import { NotSubmittedException } from "../../src/exceptions/not-submitted.exception.ts";
import { OutcomeUncertainException } from "../../src/exceptions/outcome-uncertain.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageChangedAfterGrantException } from "../../src/exceptions/page-changed-after-grant.exception.ts";
import { PageCrashedException } from "../../src/exceptions/page-crashed.exception.ts";
import { PageNotShowingException } from "../../src/exceptions/page-not-showing.exception.ts";
import { PermissionDeniedException } from "../../src/exceptions/permission-denied.exception.ts";
import { PermissionExpiredException } from "../../src/exceptions/permission-expired.exception.ts";
import { PermissionWithdrawnException } from "../../src/exceptions/permission-withdrawn.exception.ts";
import { ProfileClearedException } from "../../src/exceptions/profile-cleared.exception.ts";
import { ProtocolFailedException } from "../../src/exceptions/protocol-failed.exception.ts";
import { ReplyTooLargeException } from "../../src/exceptions/reply-too-large.exception.ts";
import { RiskRoseException } from "../../src/exceptions/risk-rose.exception.ts";
import { SessionEndedException } from "../../src/exceptions/session-ended.exception.ts";
import { ShortcutRefusedException } from "../../src/exceptions/shortcut-refused.exception.ts";
import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";
import { ViewClosedException } from "../../src/exceptions/view-closed.exception.ts";
import { ViewsUnavailableException } from "../../src/exceptions/views-unavailable.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { ToolFailures } from "../../src/services/tool-failures.ts";

const KINDS: readonly ToolAbortReason[] = [
  ToolAbortReason.Stopped, ToolAbortReason.Cancelled, ToolAbortReason.SessionEnded, ToolAbortReason.SwitchedOff, ToolAbortReason.DeadlineReached
];
const MISSING_NODE: WebViewFailure = new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found");

// A protocol failure with no code and no message, which WebViewFailure's own constructor refuses, as a malformed answer gives one.
class SilentProtocolFailure implements WebViewFailure {
  public readonly kind: WebViewFailureKind = WebViewFailureKind.Protocol;
  public readonly code: number | null = null;
  public readonly message: string | null = null;

  public toJson(): JsonObject {
    return {};
  }
}

// A permission decision that refuses the call, and the reason its failure gives.
class RefusingDecision {
  public readonly decision: PermissionDecision;
  public readonly reason: ToolFailureCode;

  public constructor(decision: PermissionDecision, reason: ToolFailureCode) {
    this.decision = decision;
    this.reason = reason;
  }
}

function granted(): ActionProgress {
  const progress: ActionProgress = new ActionProgress(() => undefined);
  progress.markGranted();
  return progress;
}

function relayed(failure: WebViewFailure): WebViewFailureException {
  return new WebViewFailureException(failure);
}

function fromRelay(failure: WebViewFailure, isReferenced: boolean = false): CallFailureException {
  return ToolFailures.fromRelay(relayed(failure), isReferenced);
}

function fromKind(kind: WebViewFailureKind): CallFailureException {
  return fromRelay(new WebViewFailure(kind));
}

describe("ToolFailures", () => {
  it("maps each relay failure to its own exception", () => {
    expect([
      WebViewFailureKind.NotOwned, WebViewFailureKind.NotAllowed, WebViewFailureKind.ShortcutRefused, WebViewFailureKind.TimedOut, WebViewFailureKind.TooLarge,
      WebViewFailureKind.ViewClosed, WebViewFailureKind.Crashed, WebViewFailureKind.ProfileCleared, WebViewFailureKind.Unavailable
    ].map(t => fromKind(t).constructor)).toEqual([
      CallRefusedException, CallRefusedException, ShortcutRefusedException, PageAnswerTimedOutException, ReplyTooLargeException, ViewClosedException,
      PageCrashedException, ProfileClearedException, ViewsUnavailableException
    ]);
    expect([
      fromRelay(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Other")),
      fromRelay(MISSING_NODE, true),
      fromRelay(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node found at given location"))
    ].map(t => t.constructor)).toEqual([ProtocolFailedException, StaleReferenceException, PageNotShowingException]);
  });

  it("maps a call Noldova Desktop refused to an internal failure", () => {
    expect(fromKind(WebViewFailureKind.NotOwned).toFailure())
      .toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The module made a call Noldova Desktop refused.", "browser.internal"));
    expect(fromKind(WebViewFailureKind.NotAllowed).moduleCode).toBe("browser.internal");
  });

  it("refuses a key that is one of the app's shortcuts", () => {
    expect(fromKind(WebViewFailureKind.ShortcutRefused).toFailure())
      .toEqual(new ToolFailure(ToolFailureCode.Refused, "The key is one of the app's shortcuts, which a page never gets.", "browser.shortcutRefused"));
  });

  it("keeps Noldova Desktop's time and size failures", () => {
    expect(fromKind(WebViewFailureKind.TimedOut).reason).toBe(ToolFailureCode.TimedOut);
    expect(fromKind(WebViewFailureKind.TooLarge).reason).toBe(ToolFailureCode.TooLarge);
  });

  it("maps a lost view, and a window that can't be reached, to unavailable with its code", () => {
    expect(fromKind(WebViewFailureKind.ViewClosed).toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The pane is closed.", "browser.viewClosed"));
    expect(fromKind(WebViewFailureKind.Crashed).moduleCode).toBe("browser.pageCrashed");
    expect(fromKind(WebViewFailureKind.ProfileCleared).moduleCode).toBe("browser.profileCleared");
    expect(fromKind(WebViewFailureKind.Unavailable).toFailure())
      .toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The app's window can't reach the page now.", "browser.viewsUnavailable"));
  });

  it("maps a missing node to a stale reference only for a call by reference", () => {
    const silent: WebViewFailure = new SilentProtocolFailure();

    expect(fromRelay(MISSING_NODE, true).moduleCode).toBe("browser.staleReference");
    expect(fromRelay(MISSING_NODE, false).moduleCode).toBe("browser.protocol");
    expect(fromRelay(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Other"), true).moduleCode).toBe("browser.protocol");
    expect(fromRelay(silent, true).moduleCode).toBe("browser.protocol");
  });

  it("keeps the relay failure as the cause", () => {
    const error: WebViewFailureException = relayed(new WebViewFailure(WebViewFailureKind.Crashed));

    expect(ToolFailures.fromRelay(error, false).cause).toBe(error);
  });

  it("lets the two allowed decisions through", () => {
    expect([PermissionDecision.AllowedOnce, PermissionDecision.AllowedAlways].map(t => ToolFailures.fromDecision(t))).toEqual([null, null]);
  });

  it.each<RefusingDecision>([
    new RefusingDecision(PermissionDecision.Denied, ToolFailureCode.Denied),
    new RefusingDecision(PermissionDecision.DeniedAlways, ToolFailureCode.Denied),
    new RefusingDecision(PermissionDecision.Expired, ToolFailureCode.Expired),
    new RefusingDecision(PermissionDecision.Withdrawn, ToolFailureCode.Withdrawn),
    new RefusingDecision(PermissionDecision.TakenOver, ToolFailureCode.Denied)
  ])("refuses a call the decision $decision answered as $reason", (row: RefusingDecision) => {
    expect(ToolFailures.fromDecision(row.decision)).toMatchObject({ reason: row.reason });
  });

  it("gives each refusing decision its own failure, and a taken-over call its own code and message", () => {
    expect([PermissionDecision.Denied, PermissionDecision.DeniedAlways, PermissionDecision.TakenOver, PermissionDecision.Expired, PermissionDecision.Withdrawn]
      .map(t => ToolFailures.fromDecision(t))).toEqual([expect.any(PermissionDeniedException), expect.any(PermissionDeniedException), expect.any(HandedOverException),
      expect.any(PermissionExpiredException), expect.any(PermissionWithdrawnException)]);
    expect([ToolFailures.fromDecision(PermissionDecision.TakenOver), ToolFailures.fromDecision(PermissionDecision.Denied)]).toMatchObject([
      { reason: ToolFailureCode.Denied, message: "The person is doing it themself; the page is theirs, focused on the element.", moduleCode: "browser.handedOver" },
      { moduleCode: null }
    ]);
  });

  it("maps a navigation outcome", () => {
    const refused: unknown = ToolFailures.fromNavigation(new WebViewNavigation(WebViewNavigationKind.Refused, "https://example.test"));
    expect(refused).toBeInstanceOf(NavigationRefusedException);
    expect(refused).toMatchObject({ origin: "https://example.test" });
    expect(ToolFailures.fromNavigation(new WebViewNavigation(WebViewNavigationKind.NoHistory))).toBeInstanceOf(NoHistoryException);
    expect(ToolFailures.fromNavigation(new WebViewNavigation(WebViewNavigationKind.Started))).toBeNull();
    expect(refused).toMatchObject({ reason: ToolFailureCode.Refused, message: "Navigation to https://example.test was refused.", moduleCode: null });
    expect(ToolFailures.fromNavigation(new WebViewNavigation(WebViewNavigationKind.NoHistory))).toMatchObject({ reason: ToolFailureCode.Refused, moduleCode: "browser.noHistory" });
  });

  it("turns any thrown value into a call failure", () => {
    const timedOut: PageAnswerTimedOutException = new PageAnswerTimedOutException();
    const bug: Error = new Error("bug");

    expect(ToolFailures.toException(timedOut, false)).toBe(timedOut);
    expect(ToolFailures.toException(relayed(MISSING_NODE), true)).toBeInstanceOf(StaleReferenceException);
    expect(ToolFailures.toException(bug, false).toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The tool failed.", "browser.internal"));
    expect(ToolFailures.toException(bug, false)).toBeInstanceOf(InternalFailureException);
    expect(ToolFailures.toException(bug, false).cause).toBe(bug);
  });

  it("reads an abort reason that markSending threw as that abort", () => {
    expect(ToolFailures.toException(ToolAbortReason.Stopped, false).toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stopped, "The call was stopped."));
    expect(ToolFailures.toException("Paused", false)).toBeInstanceOf(InternalFailureException);
  });

  it("turns a reference lost after the grant into stale, and keeps one lost before it", () => {
    const lost: CallFailureException = new StaleReferenceException();

    expect(ToolFailures.forCall(lost, new ActionProgress(() => undefined), false)).toMatchObject({ code: ToolFailureCode.Refused, moduleCode: "browser.staleReference" });
    expect(ToolFailures.forCall(lost, granted(), false).message).toBe(new PageChangedAfterGrantException().message);
    expect(ToolFailures.forCall(lost, granted(), false))
      .toEqual(new ToolFailure(ToolFailureCode.Stale, "The page changed after the action was allowed, so nothing ran; take a new snapshot."));
    expect(ToolFailures.forCall(new PageAnswerTimedOutException(), granted(), false)).toEqual(new ToolFailure(ToolFailureCode.TimedOut, "The page didn't answer in time."));
  });

  it("reports an uncertain outcome for every failure of a non-resumable action after it may have sent its input, and keeps the code it ended with", () => {
    const sent: ActionProgress = granted();
    sent.markInputSent();
    const cause: CallFailureException = new PageAnswerTimedOutException();
    const uncertain: (code: string) => ToolFailure = (code: string): ToolFailure =>
      new ToolFailure(ToolFailureCode.OutcomeUncertain, `The action ended (${code}) after its input may have been sent; take a new snapshot to see the page.`);

    expect(ToolFailures.forCall(cause, sent, true)).toEqual(uncertain("TimedOut"));
    expect(ToolFailures.forCall(cause, sent, true).message).toBe(new OutcomeUncertainException("TimedOut", cause).message);
    for (const kind of KINDS)
      expect(ToolFailures.forCall(ToolFailures.interrupted(kind), sent, true), kind).toEqual(uncertain(ToolFailures.interrupted(kind).reason));
    expect(ToolFailures.forCall(new StaleReferenceException(), sent, true)).toEqual(uncertain("browser.staleReference"));
    expect(ToolFailures.forCall(new MalformedReplyException(), sent, true)).toEqual(uncertain("browser.malformedReply"));
    expect(ToolFailures.forCall(new RiskRoseException(), sent, true)).toEqual(uncertain("browser.riskRose"));
    expect(ToolFailures.forCall(new NotSubmittedException(), sent, true)).toEqual(uncertain("browser.notSubmitted"));
    expect(ToolFailures.forCall(new Error("bug"), sent, true)).toEqual(uncertain("browser.internal"));
  });

  it("keeps a lost element or a changed page, not an uncertain outcome, when the action sent only the focus, which the page can answer by replacing the element", () => {
    const focused: (progress: ActionProgress) => ActionProgress = (progress: ActionProgress): ActionProgress => {
      progress.markInputSent(true);
      return progress;
    };
    const typed: ActionProgress = focused(granted());
    typed.markInputSent();
    const changed: ToolFailure = new ToolFailure(ToolFailureCode.Stale, "The page changed after the action was allowed, so nothing ran; take a new snapshot.");

    expect([ToolFailures.forCall(new StaleReferenceException(), focused(granted()), true), ToolFailures.forCall(new PageChangedAfterGrantException(), focused(granted()), true)])
      .toEqual([changed, changed]);
    expect(ToolFailures.forCall(new StaleReferenceException(), focused(new ActionProgress(() => undefined)), true))
      .toMatchObject({ code: ToolFailureCode.Refused, moduleCode: "browser.staleReference" });
    expect([ToolFailures.forCall(new PageAnswerTimedOutException(), focused(granted()), true), ToolFailures.forCall(new StaleReferenceException(), typed, true)].map(t => t.code))
      .toEqual([ToolFailureCode.OutcomeUncertain, ToolFailureCode.OutcomeUncertain]);
  });

  it("maps each relay failure by whether the non-resumable action may have sent its input", () => {
    const sent: ActionProgress = granted();
    sent.markInputSent();
    const failures: readonly WebViewFailure[] = [
      ...[
        WebViewFailureKind.NotOwned, WebViewFailureKind.NotAllowed, WebViewFailureKind.TimedOut, WebViewFailureKind.TooLarge, WebViewFailureKind.ViewClosed,
        WebViewFailureKind.Crashed, WebViewFailureKind.ProfileCleared, WebViewFailureKind.Unavailable
      ].map(t => new WebViewFailure(t)),
      new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node found")
    ];

    for (const failure of failures) {
      const before: ToolFailure = ToolFailures.forCall(relayed(failure), granted(), true);
      const after: ToolFailure = ToolFailures.forCall(relayed(failure), sent, true);
      expect(before.code, failure.kind).not.toBe(ToolFailureCode.OutcomeUncertain);
      expect(before, failure.kind).toEqual(ToolFailures.toException(relayed(failure), false).toFailure());
      expect(after.code, failure.kind).toBe(ToolFailureCode.OutcomeUncertain);
      expect(after.message, failure.kind).toContain(`(${Object.isNull(before.moduleCode) ? before.code : before.moduleCode})`);
    }
  });

  it("keeps a key refused as one of the app's shortcuts refused after the action sent its input, since the page never got it", () => {
    const sent: ActionProgress = granted();
    sent.markInputSent();

    expect(ToolFailures.forCall(relayed(new WebViewFailure(WebViewFailureKind.ShortcutRefused)), sent, true))
      .toEqual(new ToolFailure(ToolFailureCode.Refused, "The key is one of the app's shortcuts, which a page never gets.", "browser.shortcutRefused"));
  });

  it("reads a hit test that found nothing as a page that isn't showing, referenced or not, and another missing node as a stale reference", () => {
    const nothing: WebViewFailureException = relayed(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node found at given location"));

    expect([true, false].map(t => ToolFailures.fromRelay(nothing, t).moduleCode)).toEqual(["browser.pageNotShowing", "browser.pageNotShowing"]);
    expect(ToolFailures.fromRelay(nothing, true).reason).toBe(ToolFailureCode.Refused);
    expect(ToolFailures.fromRelay(relayed(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found")), true).moduleCode).toBe("browser.staleReference");
  });

  it("keeps the plain failure before any input, and for tools that can be resumed", () => {
    const sent: ActionProgress = granted();
    sent.markInputSent();

    expect(ToolFailures.forCall(new PageAnswerTimedOutException(), granted(), true)).toEqual(new ToolFailure(ToolFailureCode.TimedOut, "The page didn't answer in time."));
    expect(ToolFailures.forCall(ToolFailures.interrupted(ToolAbortReason.Stopped), new ActionProgress(() => undefined), true))
      .toEqual(new ToolFailure(ToolFailureCode.Stopped, "The call was stopped."));
    expect(ToolFailures.forCall(ToolFailures.interrupted(ToolAbortReason.Cancelled), granted(), true))
      .toEqual(new ToolFailure(ToolFailureCode.Cancelled, "The call was cancelled."));
    expect(ToolFailures.forCall(new PermissionWithdrawnException(), new ActionProgress(() => undefined), true).code).toBe(ToolFailureCode.Withdrawn);
    expect(ToolFailures.forCall(new PageAnswerTimedOutException(), sent, false).code).toBe(ToolFailureCode.TimedOut);
    expect(ToolFailures.forCall(ToolFailures.interrupted(ToolAbortReason.Stopped), sent, false).code).toBe(ToolFailureCode.Stopped);
    expect(ToolFailures.forCall(ToolFailures.interrupted(ToolAbortReason.SwitchedOff), sent, false).code).toBe(ToolFailureCode.Unavailable);
    expect(ToolFailures.forCall(new MalformedReplyException(), sent, false).moduleCode).toBe("browser.malformedReply");
  });

  it("gives each abort reason its code before the point of no return, and any other reason is a cancel", () => {
    const cause: Error = new Error("aborted");

    expect(KINDS.map(t => ToolFailures.interrupted(t).constructor)).toEqual([CallStoppedException, CallCancelledException, SessionEndedException,
      ModuleSwitchedOffException, CallDeadlineReachedException]);
    expect(KINDS.map(t => ToolFailures.interrupted(t).toFailure())).toEqual([
      new ToolFailure(ToolFailureCode.Stopped, "The call was stopped."),
      new ToolFailure(ToolFailureCode.Cancelled, "The call was cancelled."),
      new ToolFailure(ToolFailureCode.Cancelled, "The session ended, so the call was cancelled."),
      new ToolFailure(ToolFailureCode.Unavailable, "The module was switched off, or its tools were withdrawn."),
      new ToolFailure(ToolFailureCode.TimedOut, "The call reached its deadline.")
    ]);
    for (const kind of KINDS)
      expect(ToolFailures.fromAbort(kind)).toMatchObject({ kind });
    for (const reason of [undefined, null, "Paused", new DOMException("aborted", "AbortError"), { kind: ToolAbortReason.Stopped }])
      expect(ToolFailures.fromAbort(reason), String(reason)).toMatchObject({ kind: ToolAbortReason.Cancelled, reason: ToolFailureCode.Cancelled });
    expect(ToolFailures.fromAbort(ToolAbortReason.Stopped, cause).cause).toBe(cause);
  });
});
