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
}
