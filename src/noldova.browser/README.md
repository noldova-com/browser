# @noldova/browser

The browser module for apps on [Noldova Desktop](https://github.com/noldova-com/desktop): web pages as documents in the app's window, and agent tools that read and act on them through permission requests.
It holds the module's `module.json`, `settings.json`, `menus.json` and `webViews.json`, and its runtime part, which runs the agent tools, judges each action's risk and keeps each workspace's allowed origins.

It exports `./runtime`, the runtime part, and `./window`, which re-exports the published API of the window part, [`@noldova/browser.window`](https://github.com/noldova-com/browser/tree/main/src/noldova.browser.window).
It pins that package and [`@noldova/browser.protocol`](https://github.com/noldova-com/browser/tree/main/src/noldova.browser.protocol) at its own version.

[documents/ARCHITECTURE.md](https://github.com/noldova-com/browser/blob/main/documents/ARCHITECTURE.md) says how it is built and what an app configures, [documents/SECURITY-MODEL.md](https://github.com/noldova-com/browser/blob/main/documents/SECURITY-MODEL.md) what a page can't make an agent do, and the [README](https://github.com/noldova-com/browser#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/browser/blob/main/LICENSE).

## Contributions

- **Tools:** `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press_key`, `browser_screenshot`, `browser_console` and `browser_wait_for`, each judged for risk and asked of the person through Noldova Desktop's permission requests.
- **Methods:** the fourteen `browser.*` methods in `module.json`, which the window part calls for typed addresses, its pages, browsing data and the app's name.
- **Event:** `browser.pageActivity`, what an agent is doing on a page.
- **Settings:** `browser.linkClick`, `browser.linkMiddleClick` and `browser.systemSites` on the Browser page's Links group, `browser.agentTools` on its Agents group and `browser.localSites` on its Sites group, as `settings.json` declares them.
- **Window:** the `browser.page` document, the `browser.openPage` and `browser.newPage` commands, the page's tab row place `browser.pageTabRow`, which `menus.json` declares with `browser.newPage` in it, and the `browser.agentPages` status-bar item, which says how many pages each agent has open in the window.
- **Web views:** in `webViews.json`, the pane's keys, the debugging calls and events the tools send and take, with the bounds on their parameters, and its views' new windows.

## Data

The runtime part's migrations make two tables in the module's database:

- `allowed_origins`: each workspace's allowed origins, by `profile_key`, in their `position` order;
- `pages`: each open page's `instance`, its workspace's `profile_key` and its `url`, so a page opens again where it was, and `agent_name`, the agent whose call last acted on it, which the migration `add-page-agent` adds.

## Behaviour

[documents/ARCHITECTURE.md](https://github.com/noldova-com/browser/blob/main/documents/ARCHITECTURE.md) says how pages, profiles, origins, typed addresses and the agent tools behave, and [documents/SECURITY-MODEL.md](https://github.com/noldova-com/browser/blob/main/documents/SECURITY-MODEL.md) what each tool's risk is and what it refuses.
