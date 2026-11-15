/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionAnswerer, type IPermissionRequest, PermissionDecision, type PermissionQuestion } from "@noldova/desktop.runtime";

export interface IPendingRequest {
  readonly request: IPermissionRequest;
  readonly answer: (decision: PermissionDecision) => void;
}

export class PermissionAnswers implements IPermissionAnswerer {
  private readonly waiting: Set<IPendingRequest> = new Set();
  private markRaised: () => void = () => undefined;
  public readonly requests: IPermissionRequest[] = [];
  public automaticDecision: PermissionDecision | null = null;
  public readonly raised: Promise<void> = new Promise<void>(resolve => this.markRaised = resolve);

  public get pending(): readonly IPendingRequest[] {
    return [...this.waiting];
  }

  public answerAsync(question: PermissionQuestion, signal: AbortSignal): Promise<PermissionDecision> {
    this.requests.push(question.request);
    this.markRaised();
    if (this.automaticDecision !== null)
      return Promise.resolve(this.automaticDecision);

    return new Promise<PermissionDecision>(resolve => {
      const entry: IPendingRequest = {
        request: question.request,
        answer: (decision: PermissionDecision): void => {
          if (!this.waiting.delete(entry))
            return;
          signal.removeEventListener("abort", release);
          resolve(decision);
        }
      };
      const release = (): void => entry.answer(PermissionDecision.Withdrawn);
      signal.addEventListener("abort", release, { once: true });
      this.waiting.add(entry);
    });
  }

  public answerNext(decision: PermissionDecision): void {
    const next: IPendingRequest | undefined = this.pending[0];
    if (next === undefined)
      throw new Error("No permission request is waiting.");
    next.answer(decision);
  }

  public expireAll(): void {
    for (const entry of this.pending)
      entry.answer(PermissionDecision.Expired);
  }
}
