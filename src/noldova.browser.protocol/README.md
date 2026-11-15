# @noldova/browser.protocol

The names and messages the browser module's runtime and window parts share: the tool names, a model class for each message, such as a typed address's request or a page's claim, that writes it with `toJson` and reads it with `fromJson`, refusing a malformed one with a `JsonException` that names the field's path, and the rules both parts read alike, such as what kind of address a URL's host is.

Both parts of [`@noldova/browser`](https://github.com/noldova-com/browser/tree/main/src/noldova.browser) import it by its name, and the module pins it at its own version.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/browser/blob/main/documents/ARCHITECTURE.md) says how the parts talk, and the [README](https://github.com/noldova-com/browser#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/browser/blob/main/LICENSE).
