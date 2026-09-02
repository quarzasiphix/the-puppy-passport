-- Breeder social layer, stage 6: structured post media. posts.image_urls (plain text[]) cannot
-- carry per-item caption, alt text, ordering or a video/image distinction — this table replaces
-- it as the real path going forward; image_urls is left in place (unused by any current caller,
-- confirmed by grep) rather than dropped, since dropping a column is exactly the kind of
-- destructive change this pass avoids without an explicit instruction to do so.

create type public.post_media_type as enum ('image', 'video');

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  media_type public.post_media_type not null default 'image',
  media_url text not null,
  display_order integer not null default 0,
  caption text,
  alt_text text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index post_media_post_id_idx on public.post_media (post_id, display_order);

alter table public.post_media enable row level security;

-- Same visibility rule as the post itself — never broader (a private post's photos must not leak
-- through this table even if someone enumerates post_media directly).
create policy "viewers see media on posts they can view"
  on public.post_media for select
  to anon, authenticated
  using (public.can_view_post(post_id));

-- Only whoever can currently manage the parent post (its author, or an active member of the
-- authoring organisation — the same widened rule as 20260903000200's posts policy) may attach,
-- reorder or remove its media.
create policy "post authors manage their post's media"
  on public.post_media for all
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and (
          p.author_profile_id = (select auth.uid())
          or (p.author_organization_id is not null and public.is_org_member(p.author_organization_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and (
          p.author_profile_id = (select auth.uid())
          or (p.author_organization_id is not null and public.is_org_member(p.author_organization_id))
        )
    )
  );

create policy "admins manage all post media"
  on public.post_media for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.post_media to anon;
grant select, insert, update, delete on public.post_media to authenticated;

-- Private bucket (not "kennel-media", which is unconditionally public with no per-object
-- visibility concept) — a private/followers-only post's images must stay behind the same
-- can_view_post() check as the row data, not become guessable-URL-public just because the file
-- lives in object storage. Object path convention: `{post_id}/...`, matching every other
-- per-record bucket in this schema (transport-documents, welfare-case-documents, ...).
insert into storage.buckets (id, name, public, file_size_limit)
values ('post-media', 'post-media', false, 52428800)
on conflict (id) do nothing;

create policy "viewers read post media files for posts they can view"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'post-media'
    and public.can_view_post((storage.foldername(name))[1]::uuid)
  );

create policy "post authors upload their post's media files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and exists (
      select 1 from public.posts p
      where p.id = (storage.foldername(name))[1]::uuid
        and (
          p.author_profile_id = (select auth.uid())
          or (p.author_organization_id is not null and public.is_org_member(p.author_organization_id))
        )
    )
  );

create policy "post authors manage their post's media files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-media'
    and exists (
      select 1 from public.posts p
      where p.id = (storage.foldername(name))[1]::uuid
        and (
          p.author_profile_id = (select auth.uid())
          or (p.author_organization_id is not null and public.is_org_member(p.author_organization_id))
        )
    )
  );

create policy "post authors delete their post's media files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and exists (
      select 1 from public.posts p
      where p.id = (storage.foldername(name))[1]::uuid
        and (
          p.author_profile_id = (select auth.uid())
          or (p.author_organization_id is not null and public.is_org_member(p.author_organization_id))
        )
    )
  );

create policy "admins manage all post media files in storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'post-media' and public.is_admin())
  with check (bucket_id = 'post-media' and public.is_admin());
