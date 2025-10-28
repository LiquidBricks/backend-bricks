**Codex Request — Unit Test Preamble**

ROLE: Write **sociable** unit tests (no mocks, fakes, or stubs).

GOALS:

* Lock in observable behavior with minimal, deterministic tests.
* Keep scope small: “prompt in → value out.”

SCOPE:

* **Edit/add test files only**; do not change source.

STYLE:

* Node’s built-in runner (`node:test`) and `node:assert` with ESM.
* Use **real collaborators** (in-memory or ephemeral local servers). No external network/services.
* Use **public APIs only**; no internal layout assumptions.
* Avoid global state; isolate data per test; clean teardown.
* Be order-agnostic unless ordering is part of the contract.
* Zero flakes.

VERIFY:

* Run `npm run test`.

OUTPUT:

* Return only a short change summary (no diffs, no code).
