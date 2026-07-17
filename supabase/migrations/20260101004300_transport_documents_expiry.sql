-- Health certificates, rabies vaccination proof etc. genuinely expire — needed for the ops
-- "documents nearing expiry" review queue (docs/IMPLEMENTATION_PLAN.md #10).
alter table public.transport_documents add column expiry_date date;
