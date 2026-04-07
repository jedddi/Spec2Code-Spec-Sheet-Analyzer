create table public.snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snippet_name text not null,
  code_body text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  source_pdf_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_snippets_user_created_at
  on public.snippets(user_id, created_at desc);

create index idx_snippets_metadata_json
  on public.snippets
  using gin (metadata_json);

alter table public.snippets enable row level security;

create policy "Users can view own snippets"
  on public.snippets for select
  using (auth.uid() = user_id);

create policy "Users can insert own snippets"
  on public.snippets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own snippets"
  on public.snippets for update
  using (auth.uid() = user_id);

create policy "Users can delete own snippets"
  on public.snippets for delete
  using (auth.uid() = user_id);
