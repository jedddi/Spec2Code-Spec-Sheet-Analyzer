alter table public.documents
  add column if not exists project_name text not null default 'Current Thesis',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists hidden boolean not null default false,
  add column if not exists hidden_at timestamptz null;
