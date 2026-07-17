-- Private rehoming listings (an individual owner's dog, not an organisation's) need a rough
-- location shown publicly, same as breeder/foundation listings already show their organisation's
-- city/country. There's no city/country on `animals` itself for the owner_profile_id case, so this
-- reads from the owner's profile instead — city/country are general, non-identifying location
-- info (unlike email/phone, deliberately excluded in 20260101003200_profiles_contact_lockdown.sql,
-- which stays in force here).
grant select (city, country) on public.profiles to anon;
