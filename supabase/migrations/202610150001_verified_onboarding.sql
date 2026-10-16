-- Defer public profiles until verified, preserving existing accounts.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
update public.profiles set onboarding_completed = true;
alter table public.profiles add constraint profiles_username_format check(username is null or username ~ '^[a-z0-9._]{3,30}$');
alter table public.profiles add constraint profiles_bio_length check(length(bio) <= 160);
create unique index if not exists profiles_username_unique on public.profiles(lower(username)) where username is not null;
grant update(display_name,role,avatar_url,username,bio,onboarding_completed) on public.profiles to authenticated;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.email_confirmed_at is not null or new.phone_confirmed_at is not null then
   insert into public.profiles(id,display_name,role)
   values(new.id,coalesce(nullif(left(trim(coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name')),100),''),'New member'),
          case when new.raw_user_meta_data->>'role'='owner' then 'owner' else 'customer' end)
   on conflict(id) do nothing;
 end if;
 return new;
end;$$;
drop trigger if exists on_auth_user_verified on auth.users;
create trigger on_auth_user_verified after update of email_confirmed_at,phone_confirmed_at
on auth.users for each row when (
 (old.email_confirmed_at is null and new.email_confirmed_at is not null)
 or (old.phone_confirmed_at is null and new.phone_confirmed_at is not null)
) execute function public.handle_new_user();
create or replace function public.ensure_profile() returns public.profiles language plpgsql security definer set search_path=public as $$
declare p public.profiles; u auth.users;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into u from auth.users where id=auth.uid();
 if not found or (u.email_confirmed_at is null and u.phone_confirmed_at is null) then raise exception 'Verify your email first'; end if;
 insert into public.profiles(id,display_name,role)
 values(u.id,coalesce(nullif(left(trim(coalesce(u.raw_user_meta_data->>'display_name',u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name')),100),''),'New member'),
        case when u.raw_user_meta_data->>'role'='owner' then 'owner' else 'customer' end)
 on conflict(id) do nothing;
 select * into p from public.profiles where id=auth.uid();
 return p;
end;$$;
revoke all on function public.ensure_profile() from public,anon;
grant execute on function public.ensure_profile() to authenticated;
notify pgrst,'reload schema';
