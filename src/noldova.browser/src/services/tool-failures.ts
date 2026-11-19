/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailureKind, type WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";
import { PermissionDecision, ToolAbortReason, type ToolFailure, WebViewFailureException } from "@noldova/desktop.runtime";

import { CallCancelledException } from "../exceptions/call-cancelled.exception.ts";
import { CallDeadlineReachedException } from "../exceptions/call-deadline-reached.exception.ts";
import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import type { CallInterruptedException } from "../exceptions/call-interrupted.exception.ts";
import { CallRefusedException } from "../exceptions/call-refused.exception.ts";
import { CallStoppedException } from "../exceptions/call-stopped.exception.ts";
import { HandedOverException } from "../exceptions/handed-over.exception.ts";
import { InternalFailureException } from "../exceptions/internal-failure.exception.ts";
import { ModuleSwitchedOffException } from "../exceptions/module-switched-off.exception.ts";
import { NavigationRefusedException } from "../exceptions/navigation-refused.exception.ts";
import { NoHistoryException } from "../exceptions/no-history.exception.ts";
import { OutcomeUncertainException } from "../exceptions/outcome-uncertain.exception.ts";
import { PageAnswerTimedOutException } from "../exceptions/page-answer-timed-out.exception.ts";
import { PageChangedAfterGrantException } from "../exceptions/page-changed-after-grant.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { PageNotShowingException } from "../exceptions/page-not-showing.exception.ts";
import { PermissionDeniedException } from "../exceptions/permission-denied.exception.ts";
import { PermissionExpiredException } from "../exceptions/permission-expired.exception.ts";
import { PermissionWithdrawnException } from "../exceptions/permission-withdrawn.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import { ReplyTooLargeException } from "../exceptions/reply-too-large.exception.ts";
import { SessionEndedException } from "../exceptions/session-ended.exception.ts";
import { ShortcutRefusedException } from "../exceptions/shortcut-refused.exception.ts";
import { StaleReferenceException } from "../exceptions/stale-reference.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
import { ViewsUnavailableException } from "../exceptions/views-unavailable.exception.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { Resources } from "../resources.ts";

export class ToolFailures {
  private static readonly ABORT_REASONS: ReadonlySet<unknown> = new Set<unknown>(Object.values(ToolAbortReason));

  public static fromAbort(reason: unknown, cause?: unknown): CallInterruptedException {
    return ToolFailures.interrupted(ToolFailures.readKind(reason), cause);
  }

  public static interrupted(kind: ToolAbortReason, cause?: unknown): CallInterruptedException {
    switch (kind) {
      case ToolAbortReason.Stopped:
        return new CallStoppedException(cause);
      case ToolAbortReason.Cancelled:
        return new CallCancelledException(cause);
      case ToolAbortReason.SessionEnded:
        return new SessionEndedException(cause);
      case ToolAbortReason.SwitchedOff:
        return new ModuleSwitchedOffException(cause);
      case ToolAbortReason.DeadlineReached:
        return new CallDeadlineReachedException(cause);
    }
  }

  public static fromRelay(error: WebViewFailureException, isReferenced: boolean): CallFailureException {
    switch (error.failure.kind) {
      case WebViewFailureKind.NotOwned:
      case WebViewFailureKind.NotAllowed:
        return new CallRefusedException(error);
      case WebViewFailureKind.ShortcutRefused:
        return new ShortcutRefusedException(error);
      case WebViewFailureKind.TimedOut:
        return new PageAnswerTimedOutException(error);
      case WebViewFailureKind.TooLarge:
        return new ReplyTooLargeException(error);
      case WebViewFailureKind.ViewClosed:
        return new ViewClosedException(error);
      case WebViewFailureKind.Crashed:
        return new PageCrashedException(error);
      case WebViewFailureKind.ProfileCleared:
        return new ProfileClearedException(error);
      case WebViewFailureKind.Unavailable:
        return new ViewsUnavailableException(error);
      case WebViewFailureKind.Protocol:
        if (error.failure.message === Resources.noNodeAtPoint)
          return new PageNotShowingException(error);
        return isReferenced && error.failure.message?.startsWith(Resources.missingNodePrefix) === true
          ? new StaleReferenceException(error)
          : new ProtocolFailedException(error);
    }
  }

  public static fromDecision(decision: PermissionDecision): CallFailureException | null {
    switch (decision) {
      case PermissionDecision.AllowedOnce:
      case PermissionDecision.AllowedAlways:
        return null;
      case PermissionDecision.Denied:
      case PermissionDecision.DeniedAlways:
        return new PermissionDeniedException();
      case PermissionDecision.TakenOver:
        return new HandedOverException();
      case PermissionDecision.Expired:
        return new PermissionExpiredException();
      case PermissionDecision.Withdrawn:
        return new PermissionWithdrawnException();
    }
  }

  public static fromNavigation(outcome: WebViewNavigation): CallFailureException | null {
    switch (outcome.kind) {
      case WebViewNavigationKind.Started:
        return null;
      case WebViewNavigationKind.Refused:
        return new NavigationRefusedException(outcome.origin);
      case WebViewNavigationKind.NoHistory:
        return new NoHistoryException();
    }
  }

  public static toException(cause: unknown, isReferenced: boolean): CallFailureException {
    if (cause instanceof CallFailureException)
      return cause;
    if (cause instanceof WebViewFailureException)
      return ToolFailures.fromRelay(cause, isReferenced);
    if (ToolFailures.isAbortReason(cause))
      return ToolFailures.interrupted(cause);
    return new InternalFailureException(cause);
  }

  // Whether the call failed because its element or page changed when it had sent only the focus: a page can replace an element as it takes
  // the focus, as some search fields do, and the action's own input never reached the page then.
  public static isGoneOnFocus(cause: unknown, progress: ActionProgress): boolean {
    const plain: CallFailureException = ToolFailures.toException(cause, false);
    return progress.isOnlyFocusSent && (plain instanceof StaleReferenceException || plain instanceof PageChangedAfterGrantException);
  }

  public static forCall(cause: unknown, progress: ActionProgress, isNonResumable: boolean): ToolFailure {
    const plain: CallFailureException = ToolFailures.toException(cause, false);
    if (isNonResumable && progress.isInputSent && !ToolFailures.isGoneOnFocus(cause, progress))
      return new OutcomeUncertainException(plain.moduleCode ?? plain.reason, cause).toFailure();
    if (progress.isGranted && plain instanceof StaleReferenceException)
      return new PageChangedAfterGrantException(cause).toFailure();
    return plain.toFailure();
  }

  private static readKind(reason: unknown): ToolAbortReason {
    return ToolFailures.isAbortReason(reason) ? reason : ToolAbortReason.Cancelled;
  }

  private static isAbortReason(reason: unknown): reason is ToolAbortReason {
    return ToolFailures.ABORT_REASONS.has(reason);
  }
}
