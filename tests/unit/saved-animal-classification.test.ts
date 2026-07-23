// Pure logic tests — no Supabase, no browser, no network. Run with `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySavedAnimalKind } from "../../src/lib/saved-animal-classification.ts";

test("classifySavedAnimalKind", async (t) => {
  await t.test("a breeder puppy classifies as 'puppy'", () => {
    assert.equal(classifySavedAnimalKind("breeder_puppy"), "puppy");
  });

  await t.test("a foundation/shelter/rescue adoption listing classifies as 'adoption'", () => {
    assert.equal(classifySavedAnimalKind("adoption"), "adoption");
  });

  await t.test(
    "a private rehoming listing classifies as its own 'private_rehoming' kind, never 'adoption'",
    () => {
      // This is the exact bug this pass fixed: a saved private rehoming listing must not be
      // grouped with (or labelled as) a foundation adoption — they have different owners
      // (a private profile vs. a verified organisation) and different trust framing.
      assert.equal(classifySavedAnimalKind("private_rehoming"), "private_rehoming");
      assert.notEqual(classifySavedAnimalKind("private_rehoming"), "adoption");
    },
  );
});
