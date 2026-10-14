create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null check(length(display_name) between 1 and 100),
 role text not null default 'customer' check(role in ('customer','owner')),
 avatar_url text, created_at timestamptz not null default now()
);
create table public.admins (user_id uuid primary key references profiles on delete cascade);
create table public.businesses (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references profiles on delete cascade,
 name text not null check(length(name) between 2 and 100),category text not null check(length(category) between 2 and 60),
 description text not null default '' check(length(description)<=2000),contact text not null default '' check(length(contact)<=120),
 address text not null check(length(address) between 3 and 300),hours text not null default '' check(length(hours)<=500),
 latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),
 location geography(point,4326) generated always as (st_setsrid(st_makepoint(longitude,latitude),4326)::geography) stored,
 logo_url text not null default '', hidden boolean not null default false,created_at timestamptz not null default now(),
 search_document tsvector generated always as (to_tsvector('english',name||' '||category||' '||description)) stored
);
create table public.products (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses on delete cascade,
 name text not null check(length(name) between 2 and 120),description text not null default '' check(length(description)<=2000),
 category text not null check(length(category) between 2 and 60),price numeric(12,2) not null check(price between 0 and 100000000),
 image_url text not null default '',available boolean not null default true,created_at timestamptz not null default now(),
 search_document tsvector generated always as (to_tsvector('english',name||' '||category||' '||description)) stored
);
create table public.posts (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses on delete cascade,
 caption text not null check(length(trim(caption)) between 1 and 2200),image_url text not null default '',
 kind text not null default 'post' check(kind in ('post','offer','product')),hidden boolean not null default false,created_at timestamptz not null default now()
);
create table public.comments (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references posts on delete cascade,user_id uuid not null references profiles on delete cascade,
 body text not null check(length(trim(body)) between 1 and 1000),created_at timestamptz not null default now()
);
create table public.likes(user_id uuid references profiles on delete cascade,post_id uuid references posts on delete cascade,created_at timestamptz not null default now(),primary key(user_id,post_id));
create table public.saves(user_id uuid references profiles on delete cascade,post_id uuid references posts on delete cascade,primary key(user_id,post_id));
create table public.follows(user_id uuid references profiles on delete cascade,business_id uuid references businesses on delete cascade,created_at timestamptz not null default now(),primary key(user_id,business_id));
create table public.chats(id uuid primary key default gen_random_uuid(),customer_id uuid not null references profiles on delete cascade,business_id uuid not null references businesses on delete cascade,created_at timestamptz not null default now(),unique(customer_id,business_id));
create table public.messages (
 id uuid primary key default gen_random_uuid(),chat_id uuid not null references chats on delete cascade,sender_id uuid not null references profiles on delete cascade,
 body text not null default '' check(length(body)<=4000),image_path text,created_at timestamptz not null default now(),
 check(length(trim(body))>0 or image_path is not null)
);
create table public.chat_reads(chat_id uuid references chats on delete cascade,user_id uuid references profiles on delete cascade,read_at timestamptz not null default now(),primary key(chat_id,user_id));
create table public.reviews(id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses on delete cascade,user_id uuid not null references profiles on delete cascade,rating int not null check(rating between 1 and 5),body text not null default '' check(length(body)<=2000),created_at timestamptz not null default now(),unique(business_id,user_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,body text not null,read_at timestamptz,created_at timestamptz not null default now());
create table public.blocks(blocker_id uuid references profiles on delete cascade,blocked_id uuid references profiles on delete cascade,primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references profiles on delete cascade,target_type text not null check(target_type in ('post','business','user')),target_id uuid not null,reason text not null check(length(trim(reason)) between 5 and 1000),status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now());
create table public.rate_limits(user_id uuid not null,action text not null,window_start timestamptz not null,hits int not null,primary key(user_id,action,window_start));

create index businesses_location_idx on businesses using gist(location);
create index businesses_search_idx on businesses using gin(search_document);
create index businesses_name_trgm_idx on businesses using gin(name gin_trgm_ops);
create index products_search_idx on products using gin(search_document);
create index products_name_trgm_idx on products using gin(name gin_trgm_ops);
create index products_business_idx on products(business_id);
create index posts_feed_idx on posts(created_at desc,id desc) where not hidden;
create index posts_business_idx on posts(business_id,created_at desc);
create index comments_post_idx on comments(post_id,created_at);
create index likes_post_idx on likes(post_id);
create index follows_business_idx on follows(business_id);
create index chats_business_idx on chats(business_id);
create index messages_chat_idx on messages(chat_id,created_at desc);
create index notifications_user_idx on notifications(user_id,created_at desc);
create index reviews_business_idx on reviews(business_id);
create index blocks_reverse_idx on blocks(blocked_id,blocker_id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,display_name,role) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),100),''),'New member'),case when new.raw_user_meta_data->>'role'='owner' then 'owner' else 'customer' end);
 return new;
end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from admins where user_id=auth.uid());$$;
create function public.owns_business(b uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from businesses where id=b and owner_id=auth.uid() and not hidden);$$;
create function public.is_blocked(other uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from blocks where (blocker_id=auth.uid() and blocked_id=other) or (blocked_id=auth.uid() and blocker_id=other));$$;
create function public.can_chat(c uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from chats c1 join businesses b on b.id=c1.business_id where c1.id=c and not b.hidden and auth.uid() in(c1.customer_id,b.owner_id) and not exists(select 1 from blocks where (blocker_id=c1.customer_id and blocked_id=b.owner_id) or (blocker_id=b.owner_id and blocked_id=c1.customer_id)));
$$;
create function public.rate_limit_write() returns trigger language plpgsql security definer set search_path=public as $$
declare count_hits int; max_hits int;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 max_hits:=case when tg_table_name='messages' then 60 when tg_table_name in('likes','saves','follows') then 120 else 20 end;
 insert into rate_limits(user_id,action,window_start,hits) values(auth.uid(),tg_table_name,date_trunc('minute',now()),1)
 on conflict(user_id,action,window_start) do update set hits=rate_limits.hits+1 returning hits into count_hits;
 if count_hits>max_hits then raise exception 'Rate limit exceeded. Try again in one minute.';end if;
 return new;
end;$$;

-- Column privileges prevent changing ownership, moderation state, timestamps, or notification content.
revoke all on all tables in schema public from anon,authenticated;
grant select on profiles,businesses,products,posts,comments,likes,follows,reviews to anon,authenticated;
grant select on saves,chats,messages,chat_reads,notifications,blocks,reports to authenticated;
grant update(display_name,role,avatar_url) on profiles to authenticated;
grant insert(owner_id,name,category,description,contact,address,hours,latitude,longitude,logo_url) on businesses to authenticated;
grant update(name,category,description,contact,address,hours,latitude,longitude,logo_url) on businesses to authenticated;
grant insert(business_id,name,description,category,price,image_url,available) on products to authenticated;
grant update(name,description,category,price,image_url,available) on products to authenticated;
grant insert(business_id,caption,image_url,kind) on posts to authenticated;
grant update(caption,image_url,kind) on posts to authenticated;
grant insert(post_id,user_id,body) on comments to authenticated;
grant insert(user_id,post_id) on likes,saves to authenticated;
grant insert(user_id,business_id) on follows to authenticated;
grant insert(chat_id,sender_id,body,image_path) on messages to authenticated;
grant insert(business_id,user_id,rating,body) on reviews to authenticated;
grant update(business_id,user_id,rating,body) on reviews to authenticated;
grant update(read_at) on notifications to authenticated;
grant insert(blocker_id,blocked_id) on blocks to authenticated;
grant insert(reporter_id,target_type,target_id,reason) on reports to authenticated;
grant delete on businesses,products,posts,comments,likes,saves,follows,reviews,blocks to authenticated;
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.rate_limits enable row level security;
create trigger rate_limit_businesses before insert on public.businesses for each row execute function public.rate_limit_write();
create trigger rate_limit_products before insert on public.products for each row execute function public.rate_limit_write();
create trigger rate_limit_posts before insert on public.posts for each row execute function public.rate_limit_write();
create trigger rate_limit_comments before insert on public.comments for each row execute function public.rate_limit_write();
create trigger rate_limit_likes before insert on public.likes for each row execute function public.rate_limit_write();
create trigger rate_limit_saves before insert on public.saves for each row execute function public.rate_limit_write();
create trigger rate_limit_follows before insert on public.follows for each row execute function public.rate_limit_write();
create trigger rate_limit_messages before insert on public.messages for each row execute function public.rate_limit_write();
create trigger rate_limit_reviews before insert on public.reviews for each row execute function public.rate_limit_write();
create trigger rate_limit_blocks before insert on public.blocks for each row execute function public.rate_limit_write();
create trigger rate_limit_reports before insert on public.reports for each row execute function public.rate_limit_write();
create policy profiles_read on profiles for select using(true);
create policy profiles_edit on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy business_read on businesses for select using((not hidden and not is_blocked(owner_id)) or is_admin());
create policy business_create on businesses for insert to authenticated with check(owner_id=auth.uid() and exists(select 1 from profiles where id=auth.uid() and role='owner'));
create policy business_edit on businesses for update to authenticated using(owns_business(id)) with check(owner_id=auth.uid());
create policy business_delete on businesses for delete to authenticated using(owns_business(id));
create policy product_read on products for select using(exists(select 1 from businesses b where b.id=business_id));
create policy product_create on products for insert to authenticated with check(owns_business(business_id));
create policy product_edit on products for update to authenticated using(owns_business(business_id)) with check(owns_business(business_id));
create policy product_delete on products for delete to authenticated using(owns_business(business_id));
create policy post_read on posts for select using((not hidden and exists(select 1 from businesses b where b.id=business_id)) or is_admin());
create policy post_create on posts for insert to authenticated with check(owns_business(business_id));
create policy post_edit on posts for update to authenticated using(owns_business(business_id) and not hidden) with check(owns_business(business_id));
create policy post_delete on posts for delete to authenticated using(owns_business(business_id));
create policy comment_read on comments for select using(not is_blocked(user_id) and exists(select 1 from posts p where p.id=post_id));
create policy comment_create on comments for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from posts p where p.id=post_id));
create policy comment_delete on comments for delete to authenticated using(user_id=auth.uid());
create policy likes_read on likes for select using(exists(select 1 from posts p where p.id=post_id));
create policy likes_create on likes for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from posts p where p.id=post_id));
create policy likes_delete on likes for delete to authenticated using(user_id=auth.uid());
create policy saves_read on saves for select to authenticated using(user_id=auth.uid());
create policy saves_create on saves for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from posts p where p.id=post_id));
create policy saves_delete on saves for delete to authenticated using(user_id=auth.uid());
create policy follows_read on follows for select using(exists(select 1 from businesses b where b.id=business_id));
create policy follows_create on follows for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from businesses b where b.id=business_id));
create policy follows_delete on follows for delete to authenticated using(user_id=auth.uid());
create policy chat_read on chats for select to authenticated using(can_chat(id));
create policy message_read on messages for select to authenticated using(can_chat(chat_id));
create policy message_create on messages for insert to authenticated with check(sender_id=auth.uid() and can_chat(chat_id) and (image_path is null or (split_part(image_path,'/',1)=chat_id::text and split_part(image_path,'/',2)=auth.uid()::text and exists(select 1 from storage.objects o where o.bucket_id='chat-images' and o.name=image_path))));
create policy chat_reads_read on chat_reads for select to authenticated using(user_id=auth.uid() and can_chat(chat_id));
create policy reviews_read on reviews for select using(not is_blocked(user_id) and exists(select 1 from businesses b where b.id=business_id));
create policy reviews_create on reviews for insert to authenticated with check(user_id=auth.uid() and not owns_business(business_id) and exists(select 1 from businesses b where b.id=business_id));
create policy reviews_edit on reviews for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and not owns_business(business_id) and exists(select 1 from businesses b where b.id=business_id));
create policy reviews_delete on reviews for delete to authenticated using(user_id=auth.uid());
create policy notifications_read on notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_edit on notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy blocks_read on blocks for select to authenticated using(blocker_id=auth.uid());
create policy blocks_create on blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy blocks_delete on blocks for delete to authenticated using(blocker_id=auth.uid());
create policy reports_read on reports for select to authenticated using(reporter_id=auth.uid() or is_admin());
create policy reports_create on reports for insert to authenticated with check(reporter_id=auth.uid());

create function public.start_chat(target_business uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare owner uuid; answer uuid; count_hits int;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select owner_id into owner from businesses where id=target_business and not hidden;
 if owner is null or owner=auth.uid() or is_blocked(owner) then raise exception 'Cannot start this conversation';end if;
 insert into rate_limits values(auth.uid(),'start_chat',date_trunc('minute',now()),1) on conflict(user_id,action,window_start) do update set hits=rate_limits.hits+1 returning hits into count_hits;
 if count_hits>20 then raise exception 'Rate limit exceeded';end if;
 insert into chats(customer_id,business_id) values(auth.uid(),target_business) on conflict(customer_id,business_id) do nothing;
 select id into answer from chats where customer_id=auth.uid() and business_id=target_business;
 return answer;
end;$$;
create function public.mark_chat_read(target_chat uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not can_chat(target_chat) then raise exception 'Forbidden';end if;
 insert into chat_reads(chat_id,user_id,read_at) values(target_chat,auth.uid(),now()) on conflict(chat_id,user_id) do update set read_at=excluded.read_at;
end;$$;
create function public.unread_counts() returns table(chat_id uuid,unread bigint) language sql stable security invoker set search_path=public as $$
 select m.chat_id,count(*) from messages m left join chat_reads r on r.chat_id=m.chat_id and r.user_id=auth.uid() where m.sender_id<>auth.uid() and m.created_at>coalesce(r.read_at,'epoch'::timestamptz) group by m.chat_id;
$$;
create function public.notify_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; text_body text;
begin
 if tg_table_name='messages' then
  select case when new.sender_id=c.customer_id then b.owner_id else c.customer_id end into recipient from chats c join businesses b on b.id=c.business_id where c.id=new.chat_id;
  text_body:='You have a new message.';
 elsif tg_table_name='follows' then
  select owner_id into recipient from businesses where id=new.business_id;text_body:='Someone followed your business.';
 else
  select b.owner_id into recipient from posts p join businesses b on b.id=p.business_id where p.id=new.post_id;
  text_body:=case when tg_table_name='likes' then 'Someone liked your post.' else 'Someone commented on your post.' end;
 end if;
 if recipient is not null and recipient<>auth.uid() then insert into notifications(user_id,body) values(recipient,text_body);end if;
 return new;
end;$$;
create trigger notify_message after insert on messages for each row execute function notify_activity();
create trigger notify_follow after insert on follows for each row execute function notify_activity();
create trigger notify_like after insert on likes for each row execute function notify_activity();
create trigger notify_comment after insert on comments for each row execute function notify_activity();

create function public.search_market(q text default '',filter_category text default '',price_min numeric default 0,price_max numeric default 100000000,rating_min numeric default 0,lat double precision default null,lng double precision default null,radius double precision default 25,page_offset int default 0)
returns table(id uuid,business_id uuid,kind text,name text,description text,category text,image_url text,price numeric,rating numeric,distance_km double precision)
language sql stable security invoker set search_path=public,extensions as $$
 with scores as(select r.business_id,avg(r.rating) rating from reviews r group by r.business_id),
 candidates as(
 select b.id,b.id business_id,'business'::text kind,b.name,b.description,b.category,b.logo_url image_url,null::numeric price,coalesce(s.rating,0) rating,b.location,b.search_document from businesses b left join scores s on s.business_id=b.id
 union all
 select p.id,p.business_id,'product',p.name,p.description,p.category,p.image_url,p.price,coalesce(s.rating,0),b.location,p.search_document from products p join businesses b on b.id=p.business_id left join scores s on s.business_id=b.id where p.available
 ), ranked as(
 select c.*,case when lat is not null and lng is not null then st_distance(c.location,st_setsrid(st_makepoint(lng,lat),4326)::geography)/1000 end distance_km,
 ts_rank(c.search_document,websearch_to_tsquery('english',left(q,100)))+similarity(c.name,left(q,100)) relevance
 from candidates c where (q='' or c.search_document @@ websearch_to_tsquery('english',left(q,100)) or c.name % left(q,100) or c.name ilike '%'||left(q,100)||'%')
 and (filter_category='' or c.category=filter_category) and (c.price is null or c.price between price_min and price_max) and c.rating>=rating_min
 and (lat is null or lng is null or st_dwithin(c.location,st_setsrid(st_makepoint(lng,lat),4326)::geography,least(greatest(radius,1),200)*1000))
 ) select r.id,r.business_id,r.kind,r.name,r.description,r.category,r.image_url,r.price,r.rating,r.distance_km from ranked r order by r.relevance desc,r.distance_km nulls last,r.name,r.id limit 12 offset greatest(0,least(page_offset,10000));
$$;
create function public.business_analytics() returns table(posts bigint,likes bigint,followers bigint,chat_inquiries bigint) language sql stable security invoker set search_path=public as $$
 select (select count(*) from posts p where p.business_id=b.id),(select count(*) from likes l join posts p on p.id=l.post_id where p.business_id=b.id),(select count(*) from follows f where f.business_id=b.id),(select count(*) from chats c where c.business_id=b.id) from businesses b where b.owner_id=auth.uid();
$$;
create function public.moderate_report(report_id uuid,remove_content boolean) returns void language plpgsql security definer set search_path=public as $$
declare r reports;
begin
 if not is_admin() then raise exception 'Admin access required';end if;
 select * into r from reports where id=report_id for update;
 if not found then raise exception 'Report not found';end if;
 if remove_content then
  if r.target_type='post' then update posts set hidden=true where id=r.target_id;
  elsif r.target_type='business' then update businesses set hidden=true where id=r.target_id;
  else raise exception 'User account suspension requires a trusted server admin via Supabase Auth';end if;
 end if;
 update reports set status='resolved' where id=report_id;
end;$$;

-- Public image uploads are non-executable raster formats only. Chat media stays private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('business-media','business-media',true,6291456,array['image/jpeg','image/png','image/webp']),
 ('chat-images','chat-images',false,6291456,array['image/jpeg','image/png','image/webp']);
create policy media_read on storage.objects for select using(bucket_id='business-media');
create policy media_create on storage.objects for insert to authenticated with check(bucket_id='business-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated using(bucket_id='business-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy chat_media_read on storage.objects for select to authenticated using(bucket_id='chat-images' and exists(select 1 from chats c where c.id::text=(storage.foldername(name))[1] and can_chat(c.id)));
create policy chat_media_create on storage.objects for insert to authenticated with check(bucket_id='chat-images' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from chats c where c.id::text=(storage.foldername(name))[1] and can_chat(c.id)));
create policy chat_media_delete on storage.objects for delete to authenticated using(bucket_id='chat-images' and (storage.foldername(name))[2]=auth.uid()::text);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin(),public.owns_business(uuid),public.is_blocked(uuid) to anon,authenticated;
grant execute on function public.can_chat(uuid),public.start_chat(uuid),public.mark_chat_read(uuid),public.unread_counts(),public.business_analytics(),public.moderate_report(uuid,boolean) to authenticated;
grant execute on function public.search_market(text,text,numeric,numeric,numeric,double precision,double precision,double precision,integer) to anon,authenticated;
