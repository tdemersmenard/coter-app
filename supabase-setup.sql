-- Run this in Supabase → SQL Editor → New query → Run
-- ⚠️  If re-running on existing DB: the CREATE TABLE lines will be skipped (table exists)
--     Run only the ALTER / DROP POLICY / CREATE POLICY / CREATE FUNCTION sections.

-- ============ TABLES ============

create table if not exists profs (
  id bigint generated always as identity primary key,
  name text not null,
  cegep text not null,
  dept text default 'Autre',
  courses text[] default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  unique(lower(name), cegep)
);

create table if not exists reviews (
  id bigint generated always as identity primary key,
  prof_id bigint references profs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  course text,
  rating int check (rating >= 1 and rating <= 5),
  difficulty int check (difficulty >= 1 and difficulty <= 5),
  verdict text check (verdict in ('keep', 'drop')),
  review_text text,
  grade text,
  created_at timestamp with time zone default now()
);

-- Add created_by if table already exists (safe to re-run)
alter table profs add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ============ RLS ============

alter table profs enable row level security;
alter table reviews enable row level security;

-- Drop all existing policies
drop policy if exists "Public read profs" on profs;
drop policy if exists "Public read reviews" on reviews;
drop policy if exists "Auth insert profs" on profs;
drop policy if exists "Auth insert reviews" on reviews;
drop policy if exists "Auth update profs" on profs;
drop policy if exists "Auth delete profs" on profs;
drop policy if exists "Auth delete reviews" on reviews;
drop policy if exists "Auth update reviews" on reviews;

-- SELECT: tout le monde peut lire
create policy "Public read profs" on profs
  for select to anon, authenticated using (true);

create policy "Public read reviews" on reviews
  for select to anon, authenticated using (true);

-- INSERT: seulement les users connectés, doivent s'identifier comme créateur
create policy "Auth insert profs" on profs
  for insert to authenticated
  with check (auth.uid() = created_by);

create policy "Auth insert reviews" on reviews
  for insert to authenticated
  with check (auth.uid() = user_id);

-- UPDATE: personne ne peut modifier les profs directement (via fonction seulement)
-- UPDATE reviews: seulement l'auteur
create policy "Auth update reviews" on reviews
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: personne (protection totale)
-- (pas de policy = accès refusé par défaut avec RLS activé)

-- ============ GRANTS ============

grant select on table profs to anon, authenticated;
grant select on table reviews to anon, authenticated;
grant insert on table profs to authenticated;
grant insert on table reviews to authenticated;
grant update on table reviews to authenticated;
grant usage on sequence profs_id_seq to authenticated;
grant usage on sequence reviews_id_seq to authenticated;

-- ============ FONCTION SÉCURISÉE : ajouter un cours à un prof ============
-- Utiliser cette fonction au lieu d'un UPDATE direct sur profs.
-- SECURITY DEFINER = s'exécute avec les droits admin, bypass RLS de façon contrôlée.

create or replace function append_course_to_prof(p_prof_id bigint, p_course text)
returns void language plpgsql security definer as $$
begin
  if p_course is null or trim(p_course) = '' then return; end if;
  update profs
    set courses = array_append(courses, p_course)
    where id = p_prof_id
      and not (courses @> array[p_course]);
end;
$$;

grant execute on function append_course_to_prof to authenticated;

-- ============ RATE LIMITS (DB-level, impossible à contourner) ============

-- Max 5 nouveaux profs par 24h par user
create or replace function check_prof_rate_limit()
returns trigger language plpgsql security definer as $$
declare recent_count int;
begin
  select count(*) into recent_count from profs
    where created_by = new.created_by
      and created_at > now() - interval '24 hours';
  if recent_count >= 5 then
    raise exception 'Limite atteinte : max 5 nouveaux profs par 24h.';
  end if;
  return new;
end;
$$;

drop trigger if exists prof_rate_limit on profs;
create trigger prof_rate_limit
  before insert on profs
  for each row execute function check_prof_rate_limit();

-- Max 10 reviews par 24h par user
create or replace function check_review_rate_limit()
returns trigger language plpgsql security definer as $$
declare recent_count int;
begin
  select count(*) into recent_count from reviews
    where user_id = new.user_id
      and created_at > now() - interval '24 hours';
  if recent_count >= 10 then
    raise exception 'Limite atteinte : max 10 évaluations par 24h.';
  end if;
  return new;
end;
$$;

drop trigger if exists review_rate_limit on reviews;
create trigger review_rate_limit
  before insert on reviews
  for each row execute function check_review_rate_limit();
