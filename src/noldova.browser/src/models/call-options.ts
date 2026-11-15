/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ActionProgress } from "./action-progress.ts";

export class CallOptions {
  public readonly signal: AbortSignal;
  public readonly deadline: number;
  public readonly maximumReplyBytes: number;
  public readonly isReferenced: boolean;
  public readonly progress: ActionProgress;

  public constructor(signal: AbortSignal, deadline: number, maximumReplyBytes: number, isReferenced: boolean, progress: ActionProgress) {
    this.signal = signal;
    this.deadline = deadline;
    this.maximumReplyBytes = maximumReplyBytes;
    this.isReferenced = isReferenced;
    this.progress = progress;
  }

  public withSignal(signal: AbortSignal, deadline: number): CallOptions {
    return new CallOptions(signal, deadline, this.maximumReplyBytes, this.isReferenced, this.progress);
  }

  public withDeadline(deadline: number): CallOptions {
    return new CallOptions(this.signal, deadline, this.maximumReplyBytes, this.isReferenced, this.progress);
  }

  public withMaximumReplyBytes(maximumReplyBytes: number): CallOptions {
    return new CallOptions(this.signal, this.deadline, maximumReplyBytes, this.isReferenced, this.progress);
  }

  public withProgress(progress: ActionProgress): CallOptions {
    return new CallOptions(this.signal, this.deadline, this.maximumReplyBytes, this.isReferenced, progress);
  }
}
