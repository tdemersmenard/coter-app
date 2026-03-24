-- Run this in Supabase → SQL Editor → New query → Run

-- Table des profs
create table profs (
  id bigint generated always as identity primary key,
  name text not null,
  cegep text not null,
  dept text default 'Autre',
  courses text[] default '{}',
  created_at timestamp with time zone default now(),
  unique(lower(name), cegep)
);

-- Table des reviews
create table reviews (
  id bigint generated always as identity primary key,
  prof_id bigint references profs(id) on delete cascade,
  user_id uuid references auth.users(id),
  course text,
  rating int check (rating >= 1 and rating <= 5),
  difficulty int check (difficulty >= 1 and difficulty <= 5),
  verdict text check (verdict in ('keep', 'drop')),
  review_text text,
  grade text,
  created_at timestamp with time zone default now()
);

-- Permissions (Row Level Security)
alter table profs enable row level security;
alter table reviews enable row level security;

-- Tout le monde peut lire les profs et reviews
create policy "Public read profs" on profs for select using (true);
create policy "Public read reviews" on reviews for select using (true);

-- Seulement les users connectés peuvent ajouter
create policy "Auth insert profs" on profs for insert with check (auth.role() = 'authenticated');
create policy "Auth insert reviews" on reviews for insert with check (auth.uid() = user_id);

-- Les users peuvent update les profs (pour ajouter des cours)
create policy "Auth update profs" on profs for update using (auth.role() = 'authenticated');
