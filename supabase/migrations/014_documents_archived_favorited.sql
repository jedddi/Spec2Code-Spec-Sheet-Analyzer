alter table public.documents
  add column if not exists archived boolean not null default false,
  add column if not exists favorited boolean not null default false;

-- Legacy: these were stored as project_name; fold into flags and normalize project.
update public.documents
set
  archived = true,
  project_name = 'Files'
where project_name = 'Archive';

update public.documents
set
  favorited = true,
  project_name = 'Files'
where project_name = 'Favorites';
