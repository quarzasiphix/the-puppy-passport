-- Breeder social layer, stage 1: enum widening.
--
-- posts/comments/reactions/follows/groups already exist (20260101001900_community.sql) and are
-- exactly the right primitives for the breeder social network requested — not a parallel system.
-- This migration only widens their vocabulary; `20260903000200` consumes the new values, matching
-- this codebase's own established "add enum value in its own migration, consume starting in a
-- later one" pattern (see 20260101007700/20260101007800, 20260101010600/20260101010700).
--
-- post_type gains the richer typed-post vocabulary the social feed needs (photo/video/health
-- update/dog update/planned mating/availability announcement/transport availability/educational/
-- registry announcement) — 'litter_announcement' and 'adoption_post' already existed.
alter type public.post_type add value 'photo';
alter type public.post_type add value 'video';
alter type public.post_type add value 'health_update';
alter type public.post_type add value 'dog_update';
alter type public.post_type add value 'planned_mating';
alter type public.post_type add value 'availability_announcement';
alter type public.post_type add value 'transport_availability';
alter type public.post_type add value 'educational';
alter type public.post_type add value 'registry_announcement';

-- post_visibility gains 'private' (author + admin only) and 'litter_members' (reserved for the
-- future litter-owner community — see docs/SOCIAL_DOMAIN.md; no read policy grants it visibility
-- yet, so a post set to this value is effectively private until that feature ships, never
-- accidentally public).
alter type public.post_visibility add value 'private';
alter type public.post_visibility add value 'litter_members';

-- Shared moderation vocabulary for posts and comments — a moderator hiding or removing one piece
-- of content is a distinct, auditable state, never a raw DELETE that destroys the row (matches
-- this schema's established "never hard-delete something with audit value" discipline, e.g.
-- 20260101012900_history_evidence_immutability.sql).
create type public.content_moderation_status as enum ('visible', 'hidden', 'removed');
