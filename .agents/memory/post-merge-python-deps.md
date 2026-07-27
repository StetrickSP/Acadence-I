---
name: Post-merge Python dependency installs
description: Task agents that add new Python imports do not install the packages on the main Repl — they must be installed manually after merge or the API server crashes on startup or at call-time.
---

# Post-merge Python dependency installs

## The rule
When a task agent merges Python code that imports a new package, that package is **not** automatically installed on the main Repl. The server either crashes on startup (import at module level) or throws a 500 at call-time (lazy import inside a function). Always install missing packages immediately after a task merge that adds new `import` statements.

**Why:** Task agents run in isolated Repls. `installLanguagePackages` only affects the Repl it runs in. The main Repl's `.pythonlibs` is separate.

**How to apply:** After any task merge that touches `requirements.txt` or adds new Python imports, run `installLanguagePackages({ language: "python", packages: [...] })` in the main Repl build session, then restart the affected workflow.

## Known instances
- Task #15 (Matplotlib charts) → needed `matplotlib`
- Task #30 (scikit-learn predictions) → needed `scikit-learn`

## Quick diagnosis
If the API server crashes with `ModuleNotFoundError` after a merge, or a specific endpoint returns 500 with that error in the logs, it's a missing package — install and restart, no code changes needed.
