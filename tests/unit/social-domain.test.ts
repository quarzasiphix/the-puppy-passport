import { test } from "node:test";
import assert from "node:assert/strict";

import { postNeedsListingReference } from "../../src/domains/social/status.ts";
import {
  defaultKennelSiteConfiguration,
  getKennelCapabilities,
} from "../../src/domains/breeders/types.ts";

test("availability-shaped posts without a linked animal need a listing reference", () => {
  assert.equal(postNeedsListingReference("availability_announcement", null), true);
  assert.equal(postNeedsListingReference("litter_announcement", null), true);
  assert.equal(postNeedsListingReference("adoption_post", null), true);
});

test("an availability-shaped post with a linked animal does not need one", () => {
  assert.equal(postNeedsListingReference("availability_announcement", "animal-1"), false);
});

test("non-availability post types never need a listing reference", () => {
  assert.equal(postNeedsListingReference("general", null), false);
  assert.equal(postNeedsListingReference("photo", null), false);
  assert.equal(postNeedsListingReference("health_update", null), false);
});

test("default kennel site configuration is a safe, complete fallback", () => {
  const config = defaultKennelSiteConfiguration("kennel-1");
  assert.equal(config.kennelId, "kennel-1");
  assert.equal(config.theme, "classic");
  assert.equal(config.showAnemaloBranding, true);
  assert.ok(config.visibleSections.includes("about"));
  assert.deepEqual(config.visibleSections, config.sectionOrder);
});

test("free plan has no premium capabilities", () => {
  const caps = getKennelCapabilities("free");
  assert.equal(caps.canUseCustomDomain, false);
  assert.equal(caps.canUseSubdomain, false);
  assert.equal(caps.canRemoveAnemaloBranding, false);
});

test("website plan unlocks custom domain and branding removal", () => {
  const caps = getKennelCapabilities("website");
  assert.equal(caps.canUseCustomDomain, true);
  assert.equal(caps.canRemoveAnemaloBranding, true);
});

test("pro plan sits between free and website", () => {
  const free = getKennelCapabilities("free");
  const pro = getKennelCapabilities("pro");
  const website = getKennelCapabilities("website");
  assert.equal(pro.canUseSubdomain, true);
  assert.equal(pro.canUseCustomDomain, false);
  assert.ok(pro.mediaStorageLimitMb > free.mediaStorageLimitMb);
  assert.ok(website.mediaStorageLimitMb > pro.mediaStorageLimitMb);
});
