import { pendingChangesGuard } from '@myrmidon/cadmus-core';

import { CADMUS_PART_TAXO_STORE_NODES_PG_ROUTES } from './routes';
import {
  TAXO_STORE_NODES_PART_SCHEMA,
  TAXO_STORE_NODES_PART_TYPEID,
} from './taxo-store-nodes-part';
import { TaxoStoreNodesPartFeature } from './taxo-store-nodes-part-feature/taxo-store-nodes-part-feature';

// @myrmidon/cadmus-item-editor imports packages not installed in this workspace
// (e.g. @myrmidon/cadmus-ui-flag-set), so replace it with a stub module;
// the feature component is not rendered here
vi.mock('@myrmidon/cadmus-item-editor', () => ({
  CurrentItemBarComponent: class CurrentItemBarComponent {},
}));

describe('CADMUS_PART_TAXO_STORE_NODES_PG_ROUTES', () => {
  it('should route part type to feature with pending changes guard', () => {
    expect(CADMUS_PART_TAXO_STORE_NODES_PG_ROUTES).toEqual([
      {
        path: 'it.vedph.taxo-store-nodes/:pid',
        pathMatch: 'full',
        component: TaxoStoreNodesPartFeature,
        canDeactivate: [pendingChangesGuard],
      },
    ]);
  });

  it('should have schema matching type ID', () => {
    expect(TAXO_STORE_NODES_PART_SCHEMA.$id).toContain(TAXO_STORE_NODES_PART_TYPEID);
    expect(TAXO_STORE_NODES_PART_SCHEMA.required).toContain('treeId');
    expect(TAXO_STORE_NODES_PART_SCHEMA.required).toContain('nodeIds');
  });
});
