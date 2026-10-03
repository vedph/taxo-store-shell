# History

- 2026-10-03: tests (Vitest) and fixes:
  - added `@vitest/coverage-v8` to allow running tests with `--coverage`.
  - `@myrmidon/taxo-store-api`:
    - `getTree`, `getNode` and `getNodeFromKey` now return `null` when the resource is not found (HTTP 404), as documented, rather than retrying and then erroring.
    - `getNodeFromKey` now URI-encodes tree ID and key.
    - `addNode` now returns the node ID: the API returns an empty 201 response, so the method previously emitted `null`. The ID is now the updated node's ID, or the new node's ID got from the `Location` header (when exposed) or by looking up the node by its tree and key.
    - `addTree` now returns the tree ID (`string`) rather than an always-null `number`.
    - full unit test coverage.
- 2026-09-06: updated packages.
- 2026-06-11: upgraded to Angular 22.
