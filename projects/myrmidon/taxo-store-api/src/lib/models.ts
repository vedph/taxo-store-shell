/**
 * A step in the path from the root node to a target node.
 * Used for efficient tree navigation by providing pre-calculated page numbers.
 */
export interface TaxoNodePathStep {
  /**
   * The ID of the node at this step.
   */
  nodeId: number;
  /**
   * The 1-based page number where this node appears among its siblings
   * (ordered by key) given the specified page size.
   */
  pageNumber: number;
}

/**
 * A tree in the TaxoStore.
 */
export interface TaxoStoreTree {
  /**
   * The tree's ID. This is unique in the whole store.
   */
  id: string;
  /**
   * The tree's name.
   */
  name: string;
  /**
   * An optional note attached to the tree.
   */
  note?: string;
  /**
   * True if the tree is flat, i.e. all its nodes are root nodes, so that
   * it is just a list. This is defined when the tree is created; the store
   * rejects nodes with a parent in a flat tree.
   */
  flat?: boolean;
}

/**
 * The mapping of a node to an equivalent entity in an external resource
 * (e.g. an authority file like VIAF). The pair scope + target is unique
 * within a node.
 */
export interface TaxoStoreNodeMapping {
  /**
   * The scope of the target, i.e. the identifier of the external resource
   * the target belongs to (e.g. `viaf`). Max 100 characters.
   */
  scope: string;
  /**
   * The target ID, i.e. the identifier of the equivalent entity in the
   * external resource defined by scope. Max 500 characters.
   */
  target: string;
  /**
   * An optional human-friendly label for the target. Max 500 characters.
   */
  label?: string;
}

/**
 * A node in a TaxoStore tree.
 */
export interface TaxoStoreNode {
  /**
   * The node's ID. This is unique in the whole store.
   */
  id: number;
  /**
   * The ID of the parent node, if any. Null if it has no parent.
   */
  parentId?: number;
  /**
   * The ID of the tree the node belongs to.
   */
  treeId: string;
  /**
   * The key identifying this node. This should be unique within the same
   * tree and can thus be used as a human-friendly identifier for it in the
   * context of a single set.
   */
  key: string;
  /**
   * The node's label.
   */
  label: string;
  /**
   * The node's label after filtering has been applied.
   */
  filteredLabel: string;
  /**
   * Flags attached to this node. Each character in the string is a flag.
   * For instance, <c>o</c>=obsolete, <c>d</c>=draft, etc. The value of
   * each character is defined by consumer code.
   */
  flags?: string;
  /**
   * An optional note attached to the node.
   */
  note?: string;
  /**
   * The depth level (1-based). Root nodes have y=1.
   * Only present when position data is requested.
   */
  y?: number;
  /**
   * The sibling position (1-based), ordered by key.
   * Only present when position data is requested.
   */
  x?: number;
  /**
   * Indicates whether the node has any children.
   * Only present when position data is requested.
   */
  hasChildren?: boolean;
  /**
   * The mappings of this node to external resources. When reading, these
   * are present only when requested (includeMappings), else they are null
   * or undefined. When saving, null or undefined mappings leave the node's
   * mappings untouched, while an array (even when empty) replaces them all.
   */
  mappings?: TaxoStoreNodeMapping[] | null;
}
