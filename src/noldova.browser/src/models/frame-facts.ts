/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FrameFacts {
  public readonly url: string;
  public readonly origin: string;
  public readonly documentId: string;
  public readonly frameId: string;
  // The address a failed load couldn't reach, while the frame shows the engine's error page for it.
  public readonly failedUrl: string | null;

  public constructor(url: string, origin: string, documentId: string, frameId: string, failedUrl: string | null) {
    this.url = url;
    this.origin = origin;
    this.documentId = documentId;
    this.frameId = frameId;
    this.failedUrl = failedUrl;
  }

  // The address the frame is at for the person: the one that failed to load, rather than the error page's own.
  public get address(): string {
    return this.failedUrl ?? this.url;
  }
}
