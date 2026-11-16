/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

declare var noldovaViewRequests: { url: string; error: string | null }[] | undefined;
declare var noldovaViewRequestsInFlight: Map<number, string> | undefined;
declare var noldovaViewCommits: string[] | undefined;
declare var noldovaViewFrameCommits: string[] | undefined;
