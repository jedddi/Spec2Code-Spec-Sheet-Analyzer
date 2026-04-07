update public.documents
set project_name = 'Files'
where project_name = 'Current Thesis';

alter table public.documents
  alter column project_name set default 'Files';
