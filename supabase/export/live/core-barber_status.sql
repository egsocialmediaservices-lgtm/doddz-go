create table if not exists public.barber_status (
  barber_id text not null,
  status text not null,
  updated_at timestamp with time zone default now()
);

-- القيود
alter table public.barber_status add constraint barber_status_pkey PRIMARY KEY (barber_id);
alter table public.barber_status add constraint barber_status_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

-- RLS
alter table public.barber_status enable row level security;

-- الفهارس
CREATE UNIQUE INDEX IF NOT EXISTS barber_status_pkey ON public.barber_status USING btree (barber_id);

-- السياسات
drop policy if exists "Auth write barber_status" on public.barber_status;
create policy "Auth write barber_status" on public.barber_status as permissive for all to authenticated using (true) with check (true);
drop policy if exists "Public read barber_status" on public.barber_status;
create policy "Public read barber_status" on public.barber_status as permissive for select to anon, authenticated using (true);
