import type {
  AncestorNode,
  DogIdentity,
  DogParentRelationshipStatus,
  ParentRelationship,
  PedigreeParentRole,
  PedigreeVerificationLevel,
} from "../types";
import { getPedigreeClient } from "./client";
import { getDogsByIds } from "./dogs";

// Adapted from POK's src/features/dogs/lib/pedigreeTree.ts tree-walk. Key differences:
//   * POK's dogs_registry has plain father_id/mother_id (one canonical parent per role, always
//     correct because POK IS the registry). Anemalo edges live in `dog_parent_relationships`
//     with a verification_level, and can have a competing 'disputed' row — so a node carries the
//     edge's verification level + status, and a slot can resolve to a disputed parent.
//   * POK walks in-memory over an already-loaded `dogs` array. Anemalo fetches breadth-first,
//     one batched round-trip per generation, so an N-generation tree is N queries, not a giant
//     recursive join or a full-table load.

type RawRelRow = {
  id: string;
  child_dog_id: string;
  parent_dog_id: string;
  role: PedigreeParentRole;
  verification_level: PedigreeVerificationLevel;
  status: DogParentRelationshipStatus;
  created_at: string;
};

function mapRel(r: RawRelRow): ParentRelationship {
  return {
    id: r.id,
    childDogId: r.child_dog_id,
    parentDogId: r.parent_dog_id,
    role: r.role,
    verificationLevel: r.verification_level,
    status: r.status,
    createdAt: r.created_at,
  };
}

async function fetchEdgesForChildren(childIds: string[]): Promise<ParentRelationship[]> {
  if (childIds.length === 0) return [];
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("public_dog_parent_relationships")
    .select("id, child_dog_id, parent_dog_id, role, verification_level, status, created_at")
    .in("child_dog_id", Array.from(new Set(childIds)));
  if (error) throw error;
  return ((data ?? []) as unknown as RawRelRow[]).map(mapRel);
}

/** Prefer the single 'active' edge for a (child, role); fall back to a 'disputed' one so the
 * tree still shows a contested parent rather than a bare "Unknown". */
function pickEdge(
  edges: ParentRelationship[],
  childId: string,
  role: PedigreeParentRole,
): ParentRelationship | null {
  const forSlot = edges.filter((e) => e.childDogId === childId && e.role === role);
  return (
    forSlot.find((e) => e.status === "active") ??
    forSlot.find((e) => e.status === "disputed") ??
    null
  );
}

function emptyNode(slotKey: string, role: PedigreeParentRole | null): AncestorNode {
  return {
    slotKey,
    role,
    dog: null,
    edgeId: null,
    edgeVerificationLevel: null,
    edgeStatus: null,
  };
}

export type AncestorTree = {
  root: DogIdentity;
  /** generations of ancestors requested (root not counted) */
  generations: number;
  sire: AncestorNode | null;
  dam: AncestorNode | null;
};

/**
 * Build an ancestor tree `generations` levels deep from `rootDogId`. Cycle-safe (a dog that
 * reappears on its own ancestor path — a bad crowd-sourced edge — is rendered once and not
 * expanded again).
 */
export async function getAncestorTree(
  rootDogId: string,
  rootDog: DogIdentity,
  generations = 4,
): Promise<AncestorTree> {
  const depth = Math.max(1, Math.min(generations, 8));

  // node registry keyed by slotKey; we fill it breadth-first
  const nodes = new Map<string, AncestorNode>();
  nodes.set("", {
    slotKey: "",
    role: null,
    dog: rootDog,
    edgeId: null,
    edgeVerificationLevel: null,
    edgeStatus: null,
  });

  // frontier = slotKeys whose children we still need to resolve; carries the dog id at that slot
  let frontier: { slotKey: string; dogId: string }[] = [{ slotKey: "", dogId: rootDogId }];
  const seenDogIds = new Set<string>([rootDogId]);

  for (let gen = 0; gen < depth && frontier.length > 0; gen++) {
    const edges = await fetchEdgesForChildren(frontier.map((f) => f.dogId));
    const wantedParentIds: string[] = [];
    const nextFrontier: { slotKey: string; dogId: string }[] = [];

    for (const { slotKey, dogId } of frontier) {
      for (const role of ["sire", "dam"] as const) {
        const childSlot = slotKey === "" ? role : `${slotKey}.${role}`;
        const edge = pickEdge(edges, dogId, role);
        if (!edge) {
          nodes.set(childSlot, emptyNode(childSlot, role));
          continue;
        }
        const node: AncestorNode = {
          slotKey: childSlot,
          role,
          dog: null, // filled after the batched dog fetch below
          edgeId: edge.id,
          edgeVerificationLevel: edge.verificationLevel,
          edgeStatus: edge.status,
        };
        nodes.set(childSlot, node);
        wantedParentIds.push(edge.parentDogId);
        // record which dog id this slot points at, for the fill step
        (node as AncestorNode & { _dogId?: string })._dogId = edge.parentDogId;
        if (!seenDogIds.has(edge.parentDogId)) {
          seenDogIds.add(edge.parentDogId);
          nextFrontier.push({ slotKey: childSlot, dogId: edge.parentDogId });
        }
        // else: cycle / shared ancestor already expanded elsewhere — the dog still renders at
        // this slot (via _dogId), we just don't walk its ancestors a second time.
      }
    }

    const dogMap = await getDogsByIds(wantedParentIds);
    for (const node of nodes.values()) {
      const pointer = (node as AncestorNode & { _dogId?: string })._dogId;
      if (pointer && !node.dog) node.dog = dogMap.get(pointer) ?? null;
    }

    // only recurse into slots we haven't already expanded (dedupe by dogId within this gen)
    const expandedThisGen = new Set<string>();
    frontier = nextFrontier.filter((f) => {
      if (expandedThisGen.has(f.dogId)) return false;
      expandedThisGen.add(f.dogId);
      return gen + 1 < depth;
    });
  }

  // stitch the flat node map into the nested sire/dam structure
  function build(
    slotKey: string,
    role: PedigreeParentRole | null,
    level: number,
  ): AncestorNode | null {
    const node = nodes.get(slotKey);
    if (!node) return role ? emptyNode(slotKey, role) : null;
    if (level < depth) {
      node.sire = build(slotKey === "" ? "sire" : `${slotKey}.sire`, "sire", level + 1);
      node.dam = build(slotKey === "" ? "dam" : `${slotKey}.dam`, "dam", level + 1);
    }
    return node;
  }

  return {
    root: rootDog,
    generations: depth,
    sire: build("sire", "sire", 1),
    dam: build("dam", "dam", 1),
  };
}

/** Count filled ancestor slots vs. total for a completeness indicator (adapted from POK's
 * computeTreeCompleteness). Root is not counted. */
export function computeTreeCompleteness(tree: AncestorTree): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  function walk(node: AncestorNode | null | undefined, level: number) {
    if (level > tree.generations) return;
    total += 1;
    if (node?.dog) filled += 1;
    walk(node?.sire, level + 1);
    walk(node?.dam, level + 1);
  }
  walk(tree.sire, 1);
  walk(tree.dam, 1);
  return { filled, total };
}
