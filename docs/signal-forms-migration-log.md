# Signal forms migration log

Reactive forms → signal forms (`@angular/forms/signals`, Angular 22.2.2).

Convention: **verified** = measured (test, build output, or browser run, as stated).
**Believed** = reasoned, not measured; each says how it could be checked.

## Setup (2026-10-15)

- **Verified:** baseline before any change — all tests green: api 52, editor 108,
  picker 29, app 8 (`ng test <project> --watch=false`).
- **Verified:** local libraries resolve only through `tsconfig.json` `paths` →
  `./dist/myrmidon/<lib>`. No `@myrmidon/taxo-store-*` exists in `node_modules`,
  neither as a top-level entry nor in the `.pnpm` store.
- Added `scripts/check-local-libs.mjs`: fails if any local library appears in
  `node_modules` in any form (real dir, symlink, or `.pnpm` store entry).
  **Verified** it exits 1 with a fake `node_modules/@myrmidon/taxo-store-api`
  and 0 without. Wired as `prestart` / `prebuild` / `check:libs`.
- Added `scripts/build-libs.mjs` (ported from cadmus-shell-v3): builds libraries in
  dependency order derived from manifests plus actual imports; `<name>` builds
  that library and everything downstream; `--clean-cache` also deletes
  `.angular/cache`. `npm run build:libs` now runs it.
  **Verified** order: api → editor → picker; `editor` selects editor + picker.
- The brief refers to `signal-forms-component-template.md`; it does not exist
  under `D:\Projects` or `~/.claude`. The pattern was implemented from the
  brief's description instead.
- No workspace code uses `NgxToolsValidators`, so `NgxToolsSignalValidators` is
  not needed.

## Inventory

| Component | Library | Reactive forms usage | Plan |
| --- | --- | --- | --- |
| `TaxoStoreNodeFilter` | editor | `FormGroup`, `model()` input, `<form (submit)>` | migrate |
| `TaxoStoreNodeEditorDialog` | editor | `FormGroup` with `required` | migrate |
| `TaxoStoreNodeMappings` | editor | `FormGroup` + group validator, `<form (submit)>` | migrate |
| `TaxoStorePicker` | picker | imports `FormsModule`, uses nothing from it | drop import |
| `ResetPasswordComponent` | app | `FormGroup` with `required`, `email` | migrate |
| `TaxoStoreEditorPage`, `TaxoStorePickerPage` | app | standalone `FormControl` | migrate |
| `LoginPage`, `RegisterUserPage`, `ManageUsersPage` | app | import `ReactiveFormsModule`, unused | drop import |

`taxo-store-api` has no forms.

## taxo-store-api

No forms; nothing to migrate.

## taxo-store-editor

### `TaxoStoreNodeFilter`

- `model()` API unchanged. Draft = `linkedSignal(() => toDraft(filter()))`,
  `form(draft)`; effect keyed on the draft calls `form().reset()` when the
  draft equals `toDraft(filter())`.
- **No echo guard, deliberately.** The filter is written only by an explicit
  apply (no autosave/debounce), so there is no in-flight typing to protect. The
  pre-migration component rebuilt the fields on every filter change, showing the
  applied value trimmed; rebuilding on the echo keeps that.
  **Verified** in Chrome: typing `" xyzzy-nomatch "` + Enter shows `"xyzzy-nomatch"`.
- `reset()` now sets the draft explicitly: when the filter is already `null`,
  `filter.set(null)` is a no-op and the `linkedSignal` would not recompute, leaving
  typed text in place (the old `form.reset()` cleared it).
  **Verified** by a spec that fails when that line is removed.
- `<form (submit)>` removed (the component is embedded in the editor and also
  opened in a dialog). Apply button is `type="button"` + `(click)`; Enter-to-apply
  kept via `(keydown.enter)` on both inputs. **Verified** by spec (fails without
  the binding) and in Chrome (Enter applies, no page reload).

### `TaxoStoreNodeEditorDialog`

- Data come once from `MAT_DIALOG_DATA` and never change, so the draft is a plain
  `signal(toDraft(data.node))`: there is no source for a `linkedSignal`.
- `<form>` (no submit role: Save was already `type="button"` outside it) → `div`.
- **Verified** in Chrome: `mat-form-field` error state works through
  `FormField`'s interop `NgControl` — "Label is required" hidden while the field is
  focused and untouched, shown after blur; Save disabled while invalid.

### `TaxoStoreNodeMappings`

- Draft is a plain `signal`, loaded on command by `addMapping()` /
  `editMapping()` via `form().reset(value)` (sets value, clears touched/dirty).
  Not a `linkedSignal`: the draft is not derived from a model; keying it on
  `editedIndex` would stop a repeated `addMapping()` from clearing the fields.
- The group validator became `validate(p, …)` on the root returning
  `{ kind: 'duplicate' }`. It now reads `mappings()` / `editedIndex()`
  reactively instead of only re-running on value changes.
- **Length limits use `validate()` + `maxLengthError()`, not `maxLength()`.**
  **Verified** in `@angular/forms` 22.2.2 source (`FormField.elementAcceptsNativeProperty`)
  that `maxLength()` sets the native `maxLength` property on a bound text input; the
  browser would then truncate a longer paste silently, where reactive forms showed
  "Target is too long". **Verified** by spec (fails with `maxLength()`) and in Chrome
  (507 chars kept, error shown, Save disabled).
- `<form (submit)>` → `div`; Save `type="button"` + `(click)`; Enter-to-save kept
  via `(keydown.enter)`. **Verified** in Chrome inside the node dialog (nested
  flow): Enter saves the mapping, the dialog stays open, no reload; after saving
  the node, the API returned the new mapping with label trimmed and filtered
  label derived.

### Editor verification

- **Verified:** `ng test @myrmidon/taxo-store-editor` → 116 passed (108 original
  ported + 8 new). Mutation check: removing the reset draft-clear, the
  `(keydown.enter)` bindings, or the `maxChars` helper makes exactly the 4
  targeted new specs fail.
- **Verified:** `ng build` editor and downstream picker: no warnings.
- **Verified:** served code — every loaded script was fetched from the page and
  grepped; `mapping-form`, `maxChars`, `node-form` were present in `/main.js`.
- Browser false alarm: one run reported a required error "while focused".
  **Verified:** at that moment `document.activeElement` was `null`, so the label
  had already lost focus (hence was touched) — the check's premise was false. With
  a 600 ms settle after the dialog opens the check passes (`active: label`), and an
  isolated probe showed `touched: false`, no error while focused; error after blur.
  **Believed** cause: the dialog's own opening focus handling (Material) moved
  focus after the script focused the label. Could be checked by running
  `SETTLE=0` against the pre-migration commit.

## taxo-store-picker

- `TaxoStorePicker` imported `FormsModule` but used no forms directive (its
  selects are bound with `[value]` / `(selectionChange)` to plain signals).
  Import removed; nothing else to migrate.
- **Verified:** `ng test` → 29 passed; `ng build` clean.

## App (`taxo-store-shell`)

### `ResetPasswordComponent`

A genuine submission root, so it is the one place using
`<form [formRoot]="form">` with `form(…, { submission: { action } })`.
`busy` is now `computed(() => form().submitting())` (the framework's own
in-flight state; `submit()` also refuses re-entry while submitting).
DI moved to `inject()`, since the constructor existed only for `FormBuilder`.

Behaviour, **verified** in Chrome before and after (the reset request was
intercepted over CDP and answered locally, never reaching the API; each run
confirmed which version was served by grepping the served bundle):

| Interaction | Before | After |
| --- | --- | --- |
| Click "reset password" (valid email) | no request | no request |
| Enter in field, valid email | 1 POST | 1 POST |
| Enter in field, `not-an-email` | **1 POST with `not-an-email`** | no request, errors shown |
| Errors before touch | hidden | hidden |

- **Behaviour change (deliberate, owner to confirm):** an invalid email is no
  longer posted on Enter. `submit()` only runs the action when the form is valid;
  the old `reset()` only checked for an empty value. The "reset password" button
  was already disabled while invalid, so this matches the existing UI intent.
- **Pre-existing bug, preserved, not fixed:** the `type="submit"` button is in
  `mat-card-actions`, outside the `<form>`, so it has no form owner
  (**verified**: `button.form === null`) and clicking it does nothing. The only
  working path is Enter. One-line fix if wanted: move the button into the form, or
  give the form an `id` and the button `form="<id>"`.

### `TaxoStoreEditorPage`, `TaxoStorePickerPage`

- `FormControl` → `form(signal({ treeId: DEFAULT_TREE_ID }), p => required(p.treeId))`
  bound to `mat-select` (a CVA) or the fallback `input`. `clearSelection()` uses
  `form().reset({ treeId: DEFAULT_TREE_ID })`, matching the old non-nullable
  `FormControl.reset()` (back to `'animals'`).
- **Verified** in Chrome (picker page): the select shows the default; picking
  "Food (food)" updates it and the picker gets `treeId = food`; Clear restores
  "Animals (animals)"; in the nested page → picker → editor → filter chain,
  Enter applies the filter with no reload and the panel stays open.

### `LoginPage`, `RegisterUserPage`, `ManageUsersPage`

Unused `ReactiveFormsModule` imports removed (their forms live in the external
`@myrmidon/auth-jwt-*` libraries, which already use signal forms).

### App verification

- **Verified:** `ng test taxo-store-shell` → 14 passed (8 original + 6 new:
  reset submit valid/invalid/empty, editor page default/required/clear).
- **Verified:** `npm run build` (runs the `prebuild` guard) → clean.
- Test-setup note, **verified** by printing state: the editor-page spec must
  flush the tree list and wait a macrotask; otherwise `loading()` is still true
  and the load button is disabled.

## Final state

- **Verified:** no import from `@angular/forms` (reactive/template) remains in
  `src/` or `projects/`; only `@angular/forms/signals`.
- **Verified:** all libraries rebuilt in order via `scripts/build-libs.mjs`; all
  tests green: api 52, editor 116, picker 29, app 14 (baseline 197 → 211).
- Browser runs added test mappings to node 1 in the mock DB; they were removed
  afterwards via the API (**verified**: node 1 back to its 2 original mappings).

## Out of scope — reported, not changed

1. Reset-password submit button outside its form (see above).
2. `/reset-password` is guarded by `jwtGuard`, so a user who forgot their
   password must be logged in to reach it.
3. `taxo-store-editor` imports `@angular/forms/signals` and `@angular/material`
   and `taxo-store-picker` imports `@angular/material`, but neither manifest lists
   them in `peerDependencies` (already true before the migration for
   `@angular/forms`).
4. `dist/myrmidon/cadmus-part-taxo-store-nodes` (built 2026-10-03) has no
   project in this workspace; a stale build that nothing here produces.
5. `AGENTS.md` and `.claude/CLAUDE.md` still say "Prefer Reactive forms".
6. `angular.json` sets `cli.packageManager: npm`, while `package.json` declares
   `pnpm@12.11.2`; both `package-lock.json` and `pnpm-lock.yaml` exist.
7. App auth pages use constructor injection, `standalone: true` and
   `ChangeDetectionStrategy.Eager`, contrary to the project guidelines; the
   login page logs the user object with `console.log`. No `console.log` in
   library code.
8. `taxo-store-picker/package.json` homepage/repository point to
   `tree-store-shell`, the others to `taxo-store-shell`.
9. The browser console is flooded with `[PagedTreeStore] …` `console.log`
   calls from the external `@myrmidon/paged-data-browsers` package.
