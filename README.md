# TaxoStore Shell

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.1.

## Overview

This workspace contains frontend components to consume a [taxonomies tree store](https://github.com/vedph/taxo-store) via its API. This is a simple tree store for node trees, backed by a RDBMS. It allows you to create, read, update, and delete nodes in a tree structure. The store is then wrapped in an ASP.NET Core Web API for easy access.

There are just two basic entities in the store:

- **trees**: each tree is a tree with a string ID (key), a human-friendly name, an optional note, and a `flat` property telling whether all its nodes are root nodes, so that the tree is just a list. This property is defined when the tree is created, and is not editable in these components.
- **nodes**, each belonging to a tree and having:
  - a numeric ID and parent ID.
  - a string tree ID (referencing the tree's key).
  - a human-friendly ID string (key) that is unique only within its tree.
  - a human-friendly label string and its searchable (filtered) counterpart.
  - a set of flags where each character represents a boolean attribute.
  - an optional note.
  - any number of optional **mappings** to equivalent entities in external resources (e.g. authority files). Each mapping has a `scope` (the resource the target belongs to, e.g. `viaf`), a `target` (the ID of the entity in that resource, e.g. a VIAF ID), an optional human-friendly `label`, and its optional searchable counterpart (`filteredLabel`). The pair scope + target is unique within a node. Mapping labels can also be used to store aliases of the node's label: lookup finds nodes either via their own label or via any of their mapping labels.

> The project internally uses numeric **identifiers** for internal operations with nodes, and human-friendly string keys for external references (e.g., API calls). This allows for efficient database operations while maintaining usability in external interfaces. Trees have a unique string key (ID) that can be used to reference them externally, while nodes have a unique string key within their respective tree and internally just use a numeric ID, which is more compact and efficient. So, a node key is granted to be unique only within its tree, not globally. If you want to have a globally unique node key (besides its numeric ID, which is internal to the database), you need to prefix it with the tree key followed by some separator, like a slash or a dot.

So, the note data essentially consists only in its identity and the corresponding human-friendly label, plus an optional note and a bunch of customizable flags. This is generic enough and fit to its primary purposes, which is providing **taxonomies** which can be either flat (when all nodes are root nodes) or hierarchical.

For instance, imagine a taxonomy like that of [IconClass](https://iconclass.org/) for iconographic "keywords". The taxonomy which will be used will use strings as identifiers for both trees and nodes. These will usually be meaningful IDs, like `christ.hand.right.up` for a node (where each dot here represents a step down the tree), and iconography for a tree; but this is up to the taxonomy we want to represent. The store is generic enough to represent any taxonomies, like e.g. product categories, where each category can have subcategories, and each category and subcategory can have a unique key and label.

## Libraries

- `@myrmidon/taxo-store-api`: models and services for the store.
- `@myrmidon/taxo-store-editor`: tree store editor component.
- `@myrmidon/taxo-store-picker`: tree store node picker component, combining a lookup with an editor.

🚀 Build and deploy:

1. `pnpm run build-lib`;
2. `./publish.bat`.

### TaxoStore API

- 📦 `@myrmidon/taxo-store-api`
- 🟢 `TaxoStoreService`

The service with its models is designed to interact with the [TaxoStore backend API](https://github.com/vedph/taxo-store) (version 1.0.0 or later), with both read and write capabilities.

Models:

- `TaxoStoreTree`: `id`, `name`, `note`, `flat`.
- `TaxoStoreNode`: `id`, `parentId`, `treeId`, `key`, `label`, `filteredLabel`, `flags`, `note`, `mappings`, plus `x`, `y` and `hasChildren` when position data is requested.
- `TaxoStoreNodeMapping`: `scope`, `target`, `label`, `filteredLabel`.

Node **mappings** are fetched only on request, to keep bulk queries fast, and are saved with their node:

- when reading, all the methods returning nodes (`getNode`, `getNodeFromKey`, `getNodes`, `getRootNodes`, `getChildNodes`, `getDescendantNodes`, `getAncestorNodes`) have an `includeMappings` option, false by default. When mappings are not requested, `mappings` is null or undefined.
- when saving a node with `addNode`, an array of `mappings` (even when empty) replaces all the mappings of that node, while null or undefined `mappings` leave them untouched. So, never save an empty array for a node whose mappings you did not load, or you will remove them.
- `TaxoStoreNodeFilter` has `mappingScope` and `mappingTarget` to find nodes from their mappings (both are exact matches), and `filteredMappingLabel` to match any part of the filtered label of any of their mappings. When both `filteredLabel` and `filteredMappingLabel` are set, they are combined with OR: a node matches when either its own filtered label or that of any of its mappings matches.

### TaxoStore Editor

- 📦 `@myrmidon/taxo-store-editor`
- 🟢 `TaxoStoreEditor`
- 🔑 `ts-taxo-store-editor`
- ▶️ input:
  - `treeId`\*: the ID of the tree to display and edit.
  - `canPick`: whether users can pick nodes. Default is true.
  - `canEdit`: whether users can edit nodes. Default is true.
  - `canAdd`: whether users can add nodes. Default is true.
  - `canDelete`: whether users can delete nodes. DEfault is true.
  - `hideLoc`: whether to hide the location (x,y) from node display. Default is false.
  - `hideFilter`: whether to hide the per-node filter button. Default is false.
  - `pageSize`: the page size for loading nodes. Default is 20.
- 🔥 output:
  - `nodePick` (`TaxoStoreTreeNode`): emitted when a node is picked by the user.

Component for editing a tree store.

This editor displays the nodes of a tree, adding to each displayed node a set of buttons for editing it. Whenever a node is added, updated or deleted, the view gets refreshed. The purpose of the component is letting users pick one or more nodes, while also adding or editing nodes at will.

The view depends on the `flat` property of the tree, which the editor gets from the API:

- a **flat tree** is displayed as a paged list of nodes, each with its key and label. The `hideLoc` and `hideFilter` inputs do not apply to this view.
- any other tree is displayed as a paged tree, where each node can be expanded to browse its children.

In both views, nodes are sorted by their key, and can be filtered by label and flags. The label filter matches both the filtered label of nodes and the filtered labels of their mappings (e.g. aliases).

Editing is done via a `TaxoStoreService` instance, which sends requests to a backend API and then fetches the updated nodes back to refresh the view. Commands are:

- add node: a single button at the top adds a new node at the root level (the only level in a flat tree). As nodes are sorted by key, the position of the new node only depends on its key.
- pick the node: pick the node and will trigger a nodePick event with the node picked.
- edit the node: edit the current node in a popup dialog. If the user saves his changes, the component uses the service to update the backend and to fetch the updated nodes back, preserving the affected node in view.
- add child node (not in flat trees): add a new node as a child of the node where the button was pressed. The same node editor dialog opens, and on save the same update and refresh actions occur.
- delete node: delete the node where the button was pressed, after prompting for confirmation. This is available only when the node has no children.

#### Node Editor Dialog

- 🟢 `TaxoStoreNodeEditorDialog`
- 🔑 `ts-taxo-store-node-editor-dialog`

The dialog used to add or edit a node. It has two tabs:

- _general_: the node's key, label, filtered label, flags and note.
- _mappings_: the mappings of the node (see below).

The dialog gets a `TaxoStoreNodeEditorDialogData` object (`treeId`, and either the `node` to edit, or the optional `parentId` of a new node), and returns a `TaxoStoreNodeEditorDialogResult` with the edited `node`, or nothing when cancelled. The node to edit should be got with its mappings (`includeMappings`): when its mappings are null or undefined, they are saved only if the user changes them, so that they are never removed by accident.

#### Node Mappings

- 🟢 `TaxoStoreNodeMappings`
- 🔑 `ts-taxo-store-node-mappings`
- ▶️ input:
  - `mappings`: the mappings to edit (two-way bindable).
  - `lookupConfigs`: the configurations of the lookup providers (`RefLookupConfig[]`) used to pick targets. When not set, they are got from `RamStorageService` (see below).
- 🔥 output:
  - `mappingsChange` (`TaxoStoreNodeMapping[]`): emitted when mappings change.

Editor for the mappings of a node. It shows a button to add a mapping, and a table of the current mappings with their scope, target and label. Each mapping has buttons to edit it, delete it, and open its target in a new browser tab, when the target is a web address (starting with `http://` or `https://`).

When adding or editing a mapping, an editor expands below the table, where you can type scope, target, label and filtered label. Scope and target are required, and their pair must be unique within the node. The filtered label is the searchable form of the label: when empty, it defaults to the label, as for nodes.

If any **lookup providers** are configured, the editor also shows a [lookup set](https://github.com/vedph/cadmus-bricks-shell-v3/blob/master/projects/myrmidon/cadmus-refs-lookup/README.md), which fills all the fields at once. When you pick an item from a lookup:

- scope is set to the ID of the lookup provider used (the `id` of its service, e.g. `viaf`).
- target is set to the ID of the picked item (from the `itemIdGetter` of the lookup configuration).
- label is set to the name of the picked item (from the `itemLabelGetter` of the lookup configuration, or else from the `getName` function of the lookup service).
- filtered label is cleared, so that it defaults to the new label.

You can still change these values before saving the mapping.

Lookup providers are configured in your app, by storing their configurations in `RamStorageService` under the `LOOKUP_CONFIGS_KEY` key. This is the same convention used by Cadmus bricks, so that an app already configuring lookups there needs nothing else. For instance, to lookup VIAF install `@myrmidon/cadmus-refs-viaf-lookup` and in your root component:

```ts
import { RamStorageService } from '@myrmidon/ngx-tools';
import { LOOKUP_CONFIGS_KEY, RefLookupConfig } from '@myrmidon/cadmus-refs-lookup';
import { ViafRefLookupService } from '@myrmidon/cadmus-refs-viaf-lookup';

export class App {
  constructor() {
    inject(RamStorageService).store(LOOKUP_CONFIGS_KEY, [
      {
        name: 'VIAF',
        iconUrl: '/img/viaf128.png',
        description: 'Virtual International Authority File',
        label: 'ID',
        service: inject(ViafRefLookupService),
        itemIdGetter: (item: any) => item?.viafid,
        itemLabelGetter: (item: any) => item?.term,
      },
    ] as RefLookupConfig[]);
  }
}
```

When no lookup providers are configured, mappings can only be typed manually.

> ⚠️ Note that some specific providers might require further configuration of your app. For instance, VIAF requires to exclude its URL from JWT tokens to avoid a generic CORS error, i.e. in `app.config.ts` you must add this to the providers array:

```ts
providers: [
  {
    provide: AUTH_JWT_EXCLUDED_URLS,
    useValue: ['https://viaf.org/viaf/'],
  },
];
```

### TaxoStore Picker

- 📦 `@myrmidon/taxo-store-picker`
- 🟢 `TaxoStorePicker`
- 🔑 `ts-taxo-store-picker`
- ▶️ input:
  - `treeId`\*: the ID of the tree to display and edit.
  - `hasTopNodeFilter`: true if this component should show a top-level nodes filter in a select control, showing a list of top-level nodes to filter by. This is an additional filter for lookup, restricting it to the descendants (at any depth) of the selected top-level node (node's `ancestorKey`).
  - `hasFlagsFilter`: true if this component should show a flags filter in a select control, showing a list of node flags to filter by. This is an additional filter for lookup (node's flags).
  - `availableFlags`: the available flags to filter by. For each flag, an object with `id` and `name` is expected. This is used only if `hasFlagsFilter` is true.
  - `canEdit`: whether users can edit nodes. Default is true.
  - `canAdd`: whether users can add nodes. Default is true.
  - `canDelete`: whether users can delete nodes. Default is true.
  - `hideLoc`: whether to hide the location (x,y) from node display. Default is false.
  - `hideFilter`: whether to hide the per-node filter button. Default is false.
  - `label`: the label for the lookup component.
  - `pageSize`: the page size for loading nodes. Default is 20.
- 🔥 output:
  - `nodePick` (`TaxoStoreNode`): emitted when a node is picked by the user.

The lookup (`TaxoStoreLookupService`) matches the typed text against both the filtered label of nodes and the filtered labels of their mappings, so that a node can be found also via its aliases.
