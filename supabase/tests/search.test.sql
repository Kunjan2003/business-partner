begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(8);
insert into auth.users(id,raw_user_meta_data) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"display_name":"Test owner","role":"owner"}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"display_name":"Test customer","role":"customer"}');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
with inserted as(insert into businesses(owner_id,name,category,address,latitude,longitude) values(auth.uid(),'Coffee House','Food & drinks','Test road',23.0225,72.5714) returning id)
select set_config('test.business_id',id::text,true) from inserted;
insert into products(business_id,name,category,price,description) values(current_setting('test.business_id')::uuid,'Coffee beans','Food & drinks',450,'Locally roasted beans');
select is((select count(*)::integer from search_market('Cofee House') where kind='business'),1,'trigram search tolerates a misspelling');
select is((select count(*)::integer from search_market('roasted') where kind='product'),1,'full-text search includes product descriptions');
select is((select count(*)::integer from search_market(q=>'Coffee',lat=>23.0225,lng=>72.5714,radius=>1)),2,'PostGIS includes a shop and product at the same pin');
select is((select count(*)::integer from search_market(q=>'Coffee',lat=>28.6139,lng=>77.2090,radius=>1)),0,'PostGIS excludes a distant business');
select is((select count(*)::integer from search_market(price_max=>100) where kind='product'),0,'product price filter excludes expensive products');
select is((select count(*)::integer from search_market(filter_category=>'Electronics')),0,'category filter is enforced');
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
select throws_ok(format('insert into posts(business_id,caption) values(%L,''forged'')',current_setting('test.business_id')),'42501',null,'customer cannot publish under another owner');
select is(is_admin(),false,'customer is not an admin');
reset role;
select * from finish();
rollback;
