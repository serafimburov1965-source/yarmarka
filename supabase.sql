create table listings (
  id text primary key,
  title text not null,
  price numeric not null default 0,
  category text not null,
  city text not null,
  condition text not null,
  description text,
  contact text not null,
  images text[] default '{}',
  tint text,
  telegram_user_id bigint,
  telegram_username text,
  created_at timestamptz not null default now()
);

-- MVP: разрешаем чтение и запись всем (без авторизации на стороне Supabase).
-- На боевом этапе стоит заменить на политики с проверкой telegram_user_id.
alter table listings enable row level security;

create policy "public read" on listings
  for select using (true);

create policy "public insert" on listings
  for insert with check (true);
