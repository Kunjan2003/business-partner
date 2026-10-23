-- Editable public business-community profile links. Existing RLS limits writes to self.
alter table public.profiles add column if not exists website text not null default '';
alter table public.profiles add constraint profiles_website_valid check (
 length(website) <= 300 and (website = '' or website ~* '^https?://[^[:space:]]+$')
);
grant update(website) on public.profiles to authenticated;
notify pgrst, 'reload schema';
