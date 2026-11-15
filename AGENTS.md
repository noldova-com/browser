# Agent instructions

Noldova owns this repository and makes the final decisions.

## Documents

Read the owner before you work on its subject, and change a rule there.

| When you… | Read |
|---|---|
| explain what Browser is or who uses it | [README.md](README.md) |
| change the module's parts, its two forms or their boundaries | [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) |
| write tests or change what the checks cover | [documents/TESTING.md](documents/TESTING.md) |
| change what the pane isolates, which URLs load, the calls on the view, what asks the person or what results and logs carry, or review a change for risk | [documents/SECURITY-MODEL.md](documents/SECURITY-MODEL.md) |
| write code, tests, styles, documents or commits | the organization's standards, `https://github.com/noldova-com/.github/blob/main/standards/AGENTS.md` |
| build or change anything a person sees | the organization's UI standard, `https://github.com/noldova-com/.github/blob/main/standards/UI.md` |
| prepare or run a release | [README.md, Releases](README.md#releases) |

## Work

- Every pull request names the issue it resolves in this repository, such as `Closes #N`, and passes the checks [TESTING.md](documents/TESTING.md) lists.

## Browser

- Browser is a module and an app on Noldova Desktop: it installs Noldova Desktop's packages and the UI kit, `@noldova/ui.components.angular`, as published versions; never copy, fork or override their files, tokens or styles, and ask for a change through an issue in their repositories.
- The module names no app; an app that includes it configures it through its published API.
- Browser's public API is everything its packages export.
  A change that breaks it gets a new major version, release notes and a migration path for every app that uses it.
- Browser loads pages it doesn't trust and lets agents act on them: a change to what the pane isolates, which URLs load, what an agent may do or what results carry is a risky change, and its review says so.
