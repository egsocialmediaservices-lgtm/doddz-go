create table if not exists public.profiles (
  id uuid not null,
  is_admin boolean default false not null,
  role text default 'seller'::text not null,
  display_name text,
  created_at timestamp with time zone default now() not null,
  provider_type text,
  phone text,
  email text,
  governorate text,
  area text,
  street text,
  building text,
  floor text,
  category text,
  provider_id text
);

-- القيود
alter table public.profiles add constraint profiles_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['barbers'::text, 'carwash'::text, 'handmade'::text, 'merchants'::text]))));
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_provider_type_check CHECK (((provider_type = ANY (ARRAY['merchant'::text, 'service_provider'::text])) OR (provider_type IS NULL)));
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['visitor'::text, 'seller'::text, 'admin'::text, 'merchant'::text, 'service_provider'::text])));

-- RLS
alter table public.profiles enable row level security;

-- الفهارس
CREATE INDEX IF NOT EXISTS profiles_category_idx ON public.profiles USING btree (category);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_uidx ON public.profiles USING btree (phone) WHERE (phone IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);

-- السياسات
drop policy if exists "Admin can manage profiles" on public.profiles;
create policy "Admin can manage profiles" on public.profiles as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "Auth update profiles" on public.profiles;
create policy "Auth update profiles" on public.profiles as permissive for all to authenticated using (true) with check (true);
drop policy if exists "Auth upsert profiles" on public.profiles;
create policy "Auth upsert profiles" on public.profiles as permissive for insert to authenticated with check (true);
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles as permissive for select to authenticated using ((id = auth.uid()));
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles as permissive for select to public using ((auth.uid() = id));
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles as permissive for select to authenticated using (((id = auth.uid()) OR true));
drop policy if exists "profiles_insert_auth" on public.profiles;
create policy "profiles_insert_auth" on public.profiles as permissive for insert to authenticated with check (true);
drop policy if exists "profiles_select_auth" on public.profiles;
create policy "profiles_select_auth" on public.profiles as permissive for select to authenticated using (true);
drop policy if exists "profiles_update_auth" on public.profiles;
create policy "profiles_update_auth" on public.profiles as permissive for all to authenticated using (true) with check (true);
