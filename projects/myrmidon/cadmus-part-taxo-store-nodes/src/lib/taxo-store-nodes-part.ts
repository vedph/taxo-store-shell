import { Part } from '@myrmidon/cadmus-core';

/**
 * A name-value pair of strings.
 */
export interface StringPair {
  name: string;
  value: string;
}

/**
 * The TaxoStoreNodes part model.
 */
export interface TaxoStoreNodesPart extends Part {
  /**
   * The identifier of the taxonomy tree used by this part. All the nodes
   * belong to this tree.
   */
  treeId: string;
  /**
   * The collection of node identifiers included in this part.
   * Each node identifier has a name, corresponding to the node label, and
   * a value, corresponding to the node key.
   */
  nodeIds: StringPair[];
}

/**
 * The type ID used to identify the TaxoStoreNodesPart type.
 */
export const TAXO_STORE_NODES_PART_TYPEID = 'it.vedph.taxo-store-nodes';

/**
 * JSON schema for the TaxoStoreNodes part.
 * You can use the JSON schema tool at https://jsonschema.net/.
 */
export const TAXO_STORE_NODES_PART_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'www.vedph.it/cadmus/parts/' + TAXO_STORE_NODES_PART_TYPEID + '.json',
  type: 'object',
  title: 'TaxoStoreNodesPart',
  required: [
    'id',
    'itemId',
    'typeId',
    'timeCreated',
    'creatorId',
    'timeModified',
    'userId',
    'treeId',
    'nodeIds',
  ],
  properties: {
    timeCreated: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.\\d+Z$',
    },
    creatorId: {
      type: 'string',
    },
    timeModified: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.\\d+Z$',
    },
    userId: {
      type: 'string',
    },
    id: {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    },
    itemId: {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    },
    typeId: {
      type: 'string',
      pattern: '^[a-z][-0-9a-z._]*$',
    },
    roleId: {
      type: ['string', 'null'],
      pattern: '^([a-z][-0-9a-z._]*)?$',
    },
    treeId: {
      type: 'string',
    },
    nodeIds: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: {
            type: 'string',
          },
          value: {
            type: 'string',
          },
        },
      },
    },
  },
};
