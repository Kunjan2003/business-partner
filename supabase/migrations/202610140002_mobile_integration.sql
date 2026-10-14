-- Repair legacy identities that existed before the profile trigger was installed.
-- Only the current authenticated user is considered; admin status is never derived from metadata.
create function public.ensure_profile() returns public.profiles language plpgsql security definer set search_path=public as $$
declare p profiles; u auth.users;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into u from auth.users where id=auth.uid();
 if not found then raise exception 'Identity not found';end if;
 insert into profiles(id,display_name,role)
 values(u.id,coalesce(nullif(left(trim(coalesce(u.raw_user_meta_data->>'display_name',u.raw_user_meta_data->>'full_name')),100),''),'New member'),case when u.raw_user_meta_data->>'role'='owner' then 'owner' else 'customer' end)
 on conflict(id) do nothing;
 select * into p from profiles where id=auth.uid();return p;
end;$$;
revoke all on function public.ensure_profile() from public,anon;
grant execute on function public.ensure_profile() to authenticated;

create function public.business_stats(target_business uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('posts',(select count(*) from posts where business_id=b.id),'followers',(select count(*) from follows where business_id=b.id),'products',(select count(*) from products where business_id=b.id),'rating',coalesce((select avg(rating)::numeric(3,2) from reviews where business_id=b.id),0)) from businesses b where b.id=target_business;
$$;
revoke all on function public.business_stats(uuid) from public;
grant execute on function public.business_stats(uuid) to anon,authenticated;
create index messages_cursor_idx on public.messages(chat_id,created_at desc,id desc);
notify pgrst,'reload schema';

-- Google identity metadata uses full_name/name rather than display_name.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,display_name,role) values(new.id,coalesce(nullif(left(trim(coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name')),100),''),'New member'),case when new.raw_user_meta_data->>'role'='owner' then 'owner' else 'customer' end);
 return new;
end;$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
