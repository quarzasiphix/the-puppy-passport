# Community domain

Public post feed and community groups — likes, comments, join/leave, group-scoped posting. Per
`docs/DOMAIN_MODEL.md`: "the public post feed, likes and comments are real, working UI
(`_public.community.index.tsx`), not schema-only" and groups have "real, working UI as of
2026-07-22... join/leave, group-scoped posting... 11 default groups seeded."

## ⚠ Overlaps with the `social` domain — read before touching either

**`community/services/community.ts` and `social/services/posts.ts` + `services/comments.ts` +
`services/reactions.ts` both implement CRUD over the same `posts`/`comments`/`reactions` tables,
independently.** This domain has `listPublicPosts`/`createPost`/`toggleLike`/`listComments`/
`createComment`; `social` has `listKennelPosts`/`listProfilePosts`/`listCommunityPosts`/
`listFollowingFeed`/`createPost`/`softDeletePost`/`addComment`/`editComment`/
`softDeleteComment`/`setPostReaction`. Two different `createPost` functions exist with different
signatures, in two different domains, over one table. Not resolved in this pass — flagging so
whoever next touches posts/comments doesn't assume there's one canonical implementation. See
`social/AGENTS.md`'s matching note.

**If a moderator/admin "remove a post" capability is being built, `social/services/posts.ts`
already has `softDeletePost(postId)` — this domain has no equivalent.** Check there first.

## What this owns

- `posts`, `comments`, `reactions` (partial — see overlap note above) — `listPublicPosts`,
  `createPost`, `listReactionCounts`, `listMyReactedPostIds`, `toggleLike`, `listComments`,
  `createComment` (`services/community.ts`).
- `groups`, `group_members` — `listGroups`, `getGroupBySlug`, `listMyGroupIds`, `joinGroup`,
  `leaveGroup`, `countGroupMembers`, `listGroupPosts`, `createGroupPost` (`services/groups.ts`).
  This half has no counterpart in `social` — group membership/group-scoped posts are solely owned
  here.

## File structure

- `index.ts` — re-exports `services/community`, `services/groups`.
- `services/community.ts` (122 lines) — post feed + likes + comments, described above.
- `services/groups.ts` (107 lines) — group membership + group-scoped posts.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

- The `community`/`social` overlap on posts/comments/reactions (see the warning above) — no
  deprecation, no migration path documented in either domain's own comments.
- No soft-delete/hide/moderation action on a post exists in this domain (`social` has it).

## Related docs

- `docs/DOMAIN_MODEL.md` — confirms the group/post feed UI is real, not schema-only.
- `docs/SOCIAL_DOMAIN.md` — the `social` domain's own design doc; worth reading here too given the
  overlap, since it may define which of the two domains is meant to be canonical (not determined in
  this pass).

## Last significant change

Not determined from in-domain evidence in this pass; file created 2026-09-12 as part of the
project-wide `AGENTS.md` rollout, which is also when the `community`/`social` overlap was first
flagged in writing.
