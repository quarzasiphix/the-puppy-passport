// Pure classification logic, deliberately kept free of any Supabase/React import so it can be
// unit-tested directly (see tests/unit/saved-animal-classification.test.ts) without pulling in the
// browser client module, which throws at import time outside a Vite runtime. A saved animal can be
// a breeder puppy, a foundation/shelter/rescue adoption listing, or a private rehoming listing (the
// heart button on both AdoptionCard and the puppy detail page write to the same saved_animals
// table) — each needs its own framing and detail route, never "puppy" or generic "adoption" for
// everything saved.
export type ListingCategory = "breeder_puppy" | "adoption" | "private_rehoming";
export type SavedAnimalKind = "puppy" | "adoption" | "private_rehoming";

export function classifySavedAnimalKind(listingCategory: ListingCategory): SavedAnimalKind {
  return listingCategory === "breeder_puppy" ? "puppy" : listingCategory;
}
