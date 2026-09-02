-- Breeder social layer, stage 2: consumes the enum values added in 20260903000100 (never in the
-- same transaction that adds them — see that file's header), adds the columns typed posts/replies
-- need, and closes two real pre-existing gaps found while auditing this table for the social
-- feature: posts/comments with visibility = 'followers' had no working read policy at all (only
-- 'public' and 'group' were ever wired), and "reactions are publicly readable" was unconditional
-- — a reaction on a private/group-only post was still world-readable, identifying who reacted to
-- (and that there even exists) content the post's own visibility says should be hidden.

-- ---------------------------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------------------------

alter table public.posts
  add column linked_litter_id uuid references public.litters (id) on delete set null,
  add column linked_achievement_id uuid references public.achievements (id) on delete set null,
  add column deleted_at timestamptz,
  add column moderation_status public.content_moderation_status not null default 'visible';

-- One level of replies only ("deliberately limited nesting") — enforced below by
-- check_comment_reply_depth(), not just convention.
alter table public.comments
  add column parent_comment_id uuid references public.comments (id) on delete cascade,
  add column deleted_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column is_edited boolean not null default false,
  add column moderation_status public.content_moderation_status not null default 'visible';

create trigger set_comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create or replace function public.check_comment_reply_depth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_post_id uuid;
  v_parent_of_parent uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select post_id, parent_comment_id into v_parent_post_id, v_parent_of_parent
  from public.comments
  where id = new.parent_comment_id;

  if v_parent_post_id is null then
    raise exception 'Parent comment not found' using errcode = 'P0001';
  end if;
  if v_parent_post_id <> new.post_id then
    raise exception 'A reply must be on the same post as its parent comment' using errcode = 'P0001';
  end if;
  if v_parent_of_parent is not null then
    raise exception 'Replies can only be one level deep' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger check_comment_reply_depth
  before insert or update of parent_comment_id, post_id on public.comments
  for each row execute function public.check_comment_reply_depth();

-- ---------------------------------------------------------------------------------------------
-- Visibility: the one real "can this viewer see this post" predicate, reused by posts, comments,
-- reactions and (20260903000600) post_media, so the rule lives in exactly one place. Deliberately
-- does NOT special-case the author or admin — both already have their own broader ALL policies on
-- every one of these tables; this only answers the "third-party viewer" question (public /
-- follower / group member), and returns false outright once moderation has hidden or removed the
-- content, for anyone relying solely on this predicate.
-- ---------------------------------------------------------------------------------------------

create or replace function public.is_following_target(
  p_followed_profile_id uuid,
  p_followed_organization_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_profile_id = auth.uid()
      and (
        (p_followed_profile_id is not null and f.followed_profile_id = p_followed_profile_id)
        or (p_followed_organization_id is not null and f.followed_organization_id = p_followed_organization_id)
      )
  );
$$;

create or replace function public.can_view_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_post public.posts%rowtype;
begin
  select * into v_post from public.posts where id = p_post_id;
  if not found or v_post.moderation_status <> 'visible' or v_post.deleted_at is not null then
    return false;
  end if;

  if v_post.visibility = 'public' then
    return true;
  end if;

  if v_post.visibility = 'group' and v_post.group_id is not null then
    return public.is_group_member(v_post.group_id);
  end if;

  if v_post.visibility = 'followers' then
    return public.is_following_target(v_post.author_profile_id, v_post.author_organization_id);
  end if;

  -- 'private' and 'litter_members' (the latter reserved for the future litter-owner community,
  -- see 20260903000100's header) are never visible through this predicate — only the author's own
  -- ALL policy or an admin's grants it.
  return false;
end;
$$;

revoke all on function public.is_following_target(uuid, uuid) from public;
grant execute on function public.is_following_target(uuid, uuid) to authenticated;
revoke all on function public.can_view_post(uuid) from public;
grant execute on function public.can_view_post(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- posts: widen org-authored posting from owner-only to any active org member (matches this
-- schema's own convention for org-scoped resources, e.g. litters/animals via is_org_member() —
-- "only kennel members with permission can edit the kennel" was previously "only the owner",
-- which is real but narrower than the product needs for a team with several posting members),
-- and add the missing followers-visibility read path.
-- ---------------------------------------------------------------------------------------------

drop policy "authors manage their own posts" on public.posts;
create policy "authors manage their own posts"
  on public.posts for all
  to authenticated
  using (
    author_profile_id = (select auth.uid())
    or (author_organization_id is not null and public.is_org_member(author_organization_id))
  )
  with check (
    author_profile_id = (select auth.uid())
    or (author_organization_id is not null and public.is_org_member(author_organization_id))
  );

drop policy "public posts are readable by anyone" on public.posts;
drop policy "group members read group-scoped posts" on public.posts;
create policy "viewers see posts their visibility allows"
  on public.posts for select
  to anon, authenticated
  using (public.can_view_post(id));

-- Only a moderator/admin may change moderation_status — an author's own "manage their own posts"
-- ALL policy above still lets them edit content/visibility/deleted_at (a genuine self-service
-- soft-delete), just never launder their own content back to 'visible' after a moderator hid it,
-- or hide/remove someone else's report trail.
create or replace function public.prevent_non_moderator_post_moderation_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_moderator() then
    return new;
  end if;
  if new.moderation_status is distinct from old.moderation_status then
    raise exception 'Only a moderator can change a post''s moderation status.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger prevent_non_moderator_post_moderation_changes
  before update on public.posts
  for each row execute function public.prevent_non_moderator_post_moderation_changes();

grant select, insert, update, delete on public.posts to authenticated;

-- ---------------------------------------------------------------------------------------------
-- comments: same followers-visibility read path via can_view_post(post_id), plus the moderation
-- lock (comment authors can edit their own text or soft-delete, never re-show what a moderator hid).
-- ---------------------------------------------------------------------------------------------

drop policy "comments follow their post's visibility" on public.comments;
drop policy "group members read comments on group-scoped posts" on public.comments;
create policy "viewers see comments whose post they can view"
  on public.comments for select
  to anon, authenticated
  using (public.can_view_post(post_id));

create or replace function public.prevent_non_moderator_comment_moderation_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_moderator() then
    return new;
  end if;
  if new.moderation_status is distinct from old.moderation_status then
    raise exception 'Only a moderator can change a comment''s moderation status.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger prevent_non_moderator_comment_moderation_changes
  before update on public.comments
  for each row execute function public.prevent_non_moderator_comment_moderation_changes();

-- ---------------------------------------------------------------------------------------------
-- reactions: the real fix. A reaction's own visibility must match its target's (post, or the
-- comment's own post), never a blanket grant.
-- ---------------------------------------------------------------------------------------------

drop policy "reactions are publicly readable" on public.reactions;
create policy "viewers see reactions on content they can view"
  on public.reactions for select
  to anon, authenticated
  using (
    (post_id is not null and public.can_view_post(post_id))
    or (
      comment_id is not null
      and exists (
        select 1 from public.comments c
        where c.id = comment_id and public.can_view_post(c.post_id)
      )
    )
  );
