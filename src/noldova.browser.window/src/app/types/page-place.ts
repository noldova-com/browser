/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageRecord } from "@noldova/browser.protocol";

export type PagePlace = Pick<PageRecord, "profileKey" | "url">;
