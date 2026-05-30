# CadmusPartTaxoStoreNodes

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.0.

This library contains the Cadmus `TaxoStoreNodesPart`, which is the frontend counterpart of the Cadmus component in <https://github.com/vedph/taxo-store>.

Usage:

▶️ (1) install packages: `pnpm i @myrmidon/taxo-store-api @myrmidon/taxo-store-editor @myrmidon/taxo-store-picker @myrmidon/cadmus-part-taxo-store-nodes`.

▶️ (2) In your app’s project `part-editor-keys.ts`, add the mapping for the part just created, like e.g.:

```ts
// this constant refers to the project-dependent portion of the route path
// (items/:iid/taxo) in routes definitions
const TAXOSTORE = 'taxo';

// itinera parts example
[TAXO_STORE_NODES_PART_TYPEID]: {
  part: TAXOSTORE
}
```

▶️ (3) Ensure that your app routes (`app.routes.ts`) include the component from its lazily loaded library, e.g.:

```ts
// cadmus - taxo parts
{
  path: 'items/:iid/taxo',
  loadComponent: () =>
    import('@myrmidon/cadmus-part-taxo-store-nodes').then(
      (module) => module.TaxoStoreNodesPartComponent
    ),
  canActivate: [AuthJwtGuardService],
},
```
