// Public API of the breeders domain.
//
// The kennel/foundation profile surface (getMyKennel, getMyKennelProfile, updateKennel,
// getMyFoundation, ...) is re-exported here from the animals domain's breeder.ts/foundation.ts,
// which also own litter/puppy/parent-dog/breed CRUD — those two files were the prototype's single
// "breeder.ts" data module and mix org-profile concerns with animal-record concerns. Splitting
// breeder.ts into a real kennel-profile service (living here) and an animal-record service
// (staying in animals) is tracked as follow-up work in docs/FILE_MIGRATION_MAP.md — not done in
// this pass to avoid a second risky rewrite of every call site in the same migration.
export * from "../animals/services/breeder";
export * from "../animals/services/foundation";
export * from "./types";
export * from "./services/kennel-site";
