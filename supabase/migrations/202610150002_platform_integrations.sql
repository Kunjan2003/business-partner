-- Durable background push queue, device registration and direct Stream upload records.
-- Apply after 202610150001_verified_onboarding.sql.
create extension if not exists pgmq;
select pgmq.create('activity_push');

create table public.push_devices (
  expo_token text primary key check (expo_token like 'ExpoPushToken[%]' or expo_token like 'ExponentPushToken[%]'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_devices_user_idx on public.push_devices(user_id);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;
grant select,insert,delete on public.push_devices to authenticated;
grant update(user_id,platform,updated_at) on public.push_devices to authenticated;
create policy push_device_read on public.push_devices for select to authenticated using (user_id=auth.uid());
create policy push_device_create on public.push_devices for insert to authenticated with check (user_id=auth.uid());
create policy push_device_edit on public.push_devices for update to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
create policy push_device_delete on public.push_devices for delete to authenticated using(user_id=auth.uid());

-- Only trusted server functions may read/acknowledge the internal queue.
create or replace function public.queue_activity_push() returns trigger
language plpgsql security definer set search_path=public,pgmq as $$
begin
 if exists(select 1 from public.push_devices where user_id=new.user_id) then
   perform pgmq.send('activity_push',jsonb_build_object('notification_id',new.id,'user_id',new.user_id));
 end if;
 return new;
end;$$;
revoke all on function public.queue_activity_push() from public,anon,authenticated;
create trigger enqueue_activity_push after insert on public.notifications
  for each row execute function public.queue_activity_push();

create or replace function public.claim_activity_push()
returns table(msg_id bigint,read_ct integer,notification_id uuid,user_id uuid)
language sql security definer set search_path=public,pgmq as $$
 select q.msg_id,q.read_ct,(q.message->>'notification_id')::uuid,
   (q.message->>'user_id')::uuid from pgmq.read('activity_push',120,20) q;
$$;
create or replace function public.ack_activity_push(job_id bigint)
returns boolean language sql security definer set search_path=public,pgmq as $$
 select pgmq.archive('activity_push',job_id);
$$;
revoke all on function public.claim_activity_push() from public,anon,authenticated;
revoke all on function public.ack_activity_push(bigint) from public,anon,authenticated;
grant execute on function public.claim_activity_push() to service_role;
grant execute on function public.ack_activity_push(bigint) to service_role;

-- Track successful tickets to avoid replaying them after worker retries.
create table public.push_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  expo_token text not null,
  delivered_at timestamptz not null default now(),
  primary key(notification_id,expo_token)
);
revoke all on public.push_deliveries from public,anon,authenticated;

-- Cloudflare direct-creator uploads are initiated by a trusted Edge Function.
create table public.video_uploads (
  uid text primary key check(uid ~ '^[a-f0-9]{32}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  state text not null default 'uploading' check(state in ('uploading','processing','ready','error')),
  created_at timestamptz not null default now()
);
create index video_uploads_owner_idx on public.video_uploads(owner_id,created_at desc);
alter table public.video_uploads enable row level security;
revoke all on public.video_uploads from public,anon,authenticated;
grant select on public.video_uploads to authenticated;
create policy videos_owner_read on public.video_uploads for select to authenticated
 using(owner_id=auth.uid());

alter table public.posts add column video_uid text references public.video_uploads(uid) on delete set null;
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check(kind in ('post','offer','product','video'));
grant insert(video_uid) on public.posts to authenticated;
grant update(video_uid) on public.posts to authenticated;
-- A client may only attach its own uploaded video belonging to that business.
drop policy if exists post_create on public.posts;
create policy post_create on public.posts for insert to authenticated
with check(public.owns_business(business_id) and
  (video_uid is null or exists(
    select 1 from public.video_uploads v
    where v.uid=video_uid and v.owner_id=auth.uid() and v.business_id=business_id
  )));
drop policy if exists post_edit on public.posts;
create policy post_edit on public.posts for update to authenticated
using(public.owns_business(business_id) and not hidden)
with check(public.owns_business(business_id) and
  (video_uid is null or exists(
    select 1 from public.video_uploads v
    where v.uid=video_uid and v.owner_id=auth.uid() and v.business_id=business_id
  )));
notify pgrst,'reload schema';
