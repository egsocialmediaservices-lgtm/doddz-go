create table if not exists public.signup_requests (
  id uuid default gen_random_uuid() not null,
  request_type text not null,
  full_name text not null,
  email text not null,
  phone text not null,
  business_name text,
  description text,
  status text default 'pending'::text not null,
  admin_notes text,
  created_at timestamp with time zone default now() not null,
  reviewed_at timestamp with time zone,
  category text,
  user_id uuid,
  provider_id text
);

-- القيود
alter table public.signup_requests add constraint signup_requests_pkey PRIMARY KEY (id);
alter table public.signup_requests add constraint signup_requests_request_type_check CHECK ((request_type = ANY (ARRAY['merchant'::text, 'service_provider'::text])));
alter table public.signup_requests add constraint signup_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

-- RLS
alter table public.signup_requests enable row level security;

-- الفهارس
CREATE UNIQUE INDEX IF NOT EXISTS signup_requests_pkey ON public.signup_requests USING btree (id);

-- السياسات
drop policy if exists "Admin can update signup requests" on public.signup_requests;
create policy "Admin can update signup requests" on public.signup_requests as permissive for all to public using (is_admin());
drop policy if exists "Admin can view signup requests" on public.signup_requests;
create policy "Admin can view signup requests" on public.signup_requests as permissive for select to public using (is_admin());
drop policy if exists "Anon can submit signup requests" on public.signup_requests;
create policy "Anon can submit signup requests" on public.signup_requests as permissive for insert to anon, authenticated with check ((status = 'pending'::text));
drop policy if exists "Authenticated read signup requests" on public.signup_requests;
create policy "Authenticated read signup requests" on public.signup_requests as permissive for select to authenticated using (true);
drop policy if exists "Authenticated update signup requests" on public.signup_requests;
create policy "Authenticated update signup requests" on public.signup_requests as permissive for all to authenticated using (true) with check (true);
drop policy if exists "Public can submit signup requests" on public.signup_requests;
create policy "Public can submit signup requests" on public.signup_requests as permissive for insert to public with check (true);
