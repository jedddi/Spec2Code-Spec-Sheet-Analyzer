create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  citations jsonb,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session on public.chat_messages(session_id, created_at);

alter table public.chat_messages enable row level security;

create policy "Users can view own messages"
  on public.chat_messages for select
  using (session_id in (select id from public.chat_sessions where user_id = auth.uid()));

create policy "Users can insert own messages"
  on public.chat_messages for insert
  with check (session_id in (select id from public.chat_sessions where user_id = auth.uid()));

create policy "Users can update own messages"
  on public.chat_messages for update
  using (session_id in (select id from public.chat_sessions where user_id = auth.uid()));
