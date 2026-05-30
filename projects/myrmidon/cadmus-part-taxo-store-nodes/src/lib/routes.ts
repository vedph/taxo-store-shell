import { Routes } from '@angular/router';

// cadmus
import { pendingChangesGuard } from '@myrmidon/cadmus-core';

import { TAXO_STORE_NODES_PART_TYPEID } from './taxo-store-nodes-part';
import { TaxoStoreNodesPartFeature } from './taxo-store-nodes-part-feature/taxo-store-nodes-part-feature';

/**
 * Routes for the taxo-store-nodes-part feature. This is used in the main app routing module to
 * add the route for the part editor.
 */
export const CADMUS_PART_TAXO_STORE_NODES_PG_ROUTES: Routes = [
  {
    path: `${TAXO_STORE_NODES_PART_TYPEID}/:pid`,
    pathMatch: 'full',
    component: TaxoStoreNodesPartFeature,
    canDeactivate: [pendingChangesGuard],
  },
];
