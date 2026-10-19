begin;

-- A claim and its notification enter the database in the same transaction.
-- Delivery happens separately, so an email outage cannot discard a claim.
create table public.place_claim_notifications (
  claim_id uuid primary key references public.place_claims(id) on delete cascade,
  payload jsonb not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  email_id text,
  created_at timestamptz not null default now()
);
alter table public.place_claim_notifications enable row level security;
revoke all on public.place_claim_notifications from public, anon, authenticated, service_role;
create index unsent_claim_notifications on public.place_claim_notifications(available_at) where sent_at is null;

create function place_management_private.queue_claim_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.place_claim_notifications(claim_id, payload)
    select new.id, jsonb_build_object('claim_id', new.id, 'place_name', p.name, 'place_slug', p."urlSlug",
      'account_email', u.email, 'relationship', new.relationship, 'evidence', new.evidence, 'submitted_at', new.created_at)
    from public.places p join auth.users u on u.id = new.user_id where p.id = new.place_id;
  return new;
end $$;
revoke all on function place_management_private.queue_claim_notification() from public, anon, authenticated;
create trigger queue_claim_notification after insert on public.place_claims
  for each row execute function place_management_private.queue_claim_notification();

-- Leasing prevents overlapping webhook/scheduler runs from sending the same job.
-- Stop automatic retries before the provider's 24-hour idempotency window ends.
create function public.take_claim_notifications(p_limit integer default 10) returns jsonb
language sql security definer set search_path = '' as $$
  with ready as (
    select claim_id from public.place_claim_notifications
    where sent_at is null and attempts < 8 and available_at <= now()
      and (first_attempt_at is null or first_attempt_at > now() - interval '23 hours')
    order by available_at, claim_id for update skip locked limit greatest(1, least(coalesce(p_limit, 10), 10))
  ), leased as (
    update public.place_claim_notifications n set attempts = n.attempts + 1,
      first_attempt_at = coalesce(n.first_attempt_at, now()), available_at = now() + interval '5 minutes', lease_token = gen_random_uuid()
    from ready where n.claim_id = ready.claim_id returning n.claim_id, n.payload, n.lease_token
  ) select coalesce(jsonb_agg(to_jsonb(leased)), '[]'::jsonb) from leased
$$;

create function public.finish_claim_notification(p_claim_id uuid, p_lease_token uuid, p_email_id text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.place_claim_notifications set
    sent_at = case when nullif(p_email_id, '') is not null then now() else null end,
    email_id = nullif(p_email_id, ''), lease_token = null
    where claim_id = p_claim_id and lease_token = p_lease_token and sent_at is null;
  if not found then raise exception 'Notification lease is no longer valid.'; end if;
end $$;
revoke all on function public.take_claim_notifications(integer) from public, anon, authenticated;
revoke all on function public.finish_claim_notification(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.take_claim_notifications(integer) to service_role;
grant execute on function public.finish_claim_notification(uuid, uuid, text) to service_role;

commit;
