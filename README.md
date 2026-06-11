# TaxoStore Shell

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.1.

## Overview

This workspace contains frontend components to consume a [taxonomies tree store](https://github.com/vedph/taxo-store) via its API. This is a simple tree store for node trees, backed by a RDBMS. It allows you to create, read, update, and delete nodes in a tree structure. The store is then wrapped in an ASP.NET Core Web API for easy access.

There are just two basic entities in the store:

- **trees**: each tree is a tree with a string ID (key), a human-friendly name, and an optional note.
- **nodes**, each belonging to a tree and having:
  - a numeric ID and parent ID.
  - a string tree ID (referencing the tree's key).
  - a human-friendly ID string (key) that is unique only within its tree.
  - a human-friendly label string and its searchable (filtered) counterpart.
  - a set of flags where each character represents a boolean attribute.
  - an optional note.

>The project internally uses numeric **identifiers** for internal operations with nodes, and human-friendly string keys for external references (e.g., API calls). This allows for efficient database operations while maintaining usability in external interfaces. Trees have a unique string key (ID) that can be used to reference them externally, while nodes have a unique string key within their respective tree and internally just use a numeric ID, which is more compact and efficient. So, a node key is granted to be unique only within its tree, not globally. If you want to have a globally unique node key (besides its numeric ID, which is internal to the database), you need to prefix it with the tree key followed by some separator, like a slash or a dot.

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

The service with its models is designed to interact with the [TaxoStore backend API](https://github.com/vedph/taxo-store), with both read and write capabilities.

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
  - `nodePick` (`TaxoStoreNode`): emitted when a node is picked by the user.

Component for editing a tree store.

This editor uses a tree store view, which displays a readonly tree view and adds to each displayed node a set of buttons for editing it. Whenever a node is added, updated or deleted, the tree view gets refreshed. The purpose of the component is letting users pick one or more nodes, while also adding or editing nodes at will.

Editing is done via a `TaxoStoreService` instance, which sends requests to a backend API and then fetches the updated tree back to refresh the readonly tree view. This view already provides a customizable template for each node it displays. This component customizes it by adding buttons for these commands:

- pick the node: pick the node and will trigger a nodePick event with the node picked.
- edit the node: edit the current node in a popup dialog. If the user saves his changes, the component uses the service to update the backend and to fetch the updated tree back, preserving the affected node in view.
- add child node, add sibling node: add a new node either as a child of the node where the button was pressed, or as a sibling of it (after it). The same node
editor dialog opens, and on save the same update and refresh actions occur.
- delete node: delete the node where the button was pressed, after prompting for confirmation. This is available only when the node has no children.

### TaxoStore Picker

- 📦 `@myrmidon/taxo-store-picker`
- 🟢 `TaxoStorePicker`
- 🔑 `ts-taxo-store-picker`
- ▶️ input:
  - `treeId`\*: the ID of the tree to display and edit.
  - `hasTopNodeFilter`: true if this component should show a top-level nodes filter in a select control, showing a list of top-level nodes to filter by. This is an additional filter for lookup (node's `parentKey`).
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
