-- ============ CONFESSIONS TABLE ============
create table if not exists confessions (
  id bigint generated always as identity primary key,
  cegep text not null,
  content text not null check (char_length(content) <= 500),
  likes int not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null
);

-- RLS
alter table confessions enable row level security;

-- Tout le monde peut lire
create policy "confessions_select"
  on confessions for select
  using (true);

-- Seulement les users connectés peuvent insérer
create policy "confessions_insert"
  on confessions for insert
  with check (auth.uid() = user_id);

-- Les users peuvent mettre à jour les likes (UPDATE sur likes seulement, sans restriction d'auteur)
create policy "confessions_update_likes"
  on confessions for update
  using (true)
  with check (true);

-- ============ RATE LIMIT : max 3 confessions par heure par user ============
create or replace function check_confession_rate_limit()
returns trigger language plpgsql security definer as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from confessions
  where user_id = new.user_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 3 then
    raise exception 'Limite atteinte : max 3 confessions par heure.';
  end if;
  return new;
end;
$$;

drop trigger if exists confession_rate_limit on confessions;
create trigger confession_rate_limit
  before insert on confessions
  for each row execute function check_confession_rate_limit();

-- Index pour les requêtes par cégep
create index if not exists confessions_cegep_idx on confessions(cegep, created_at desc);
