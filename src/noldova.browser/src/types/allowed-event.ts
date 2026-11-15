/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type AllowedEvent =
  | "Page.loadEventFired"
  | "Page.frameNavigated"
  | "Runtime.consoleAPICalled"
  | "Runtime.exceptionThrown"
  | "Runtime.executionContextCreated"
  | "Runtime.executionContextDestroyed"
  | "Runtime.executionContextsCleared"
  | "Runtime.bindingCalled"
  | "Log.entryAdded";
