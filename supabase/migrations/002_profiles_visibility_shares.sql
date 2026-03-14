-- ============================================================
-- Fund Task Manager — migration 002
-- profiles, task visibility, created_by, task_shares
-- ============================================================

-- 1. Profiles (linked to auth.users)
-- ------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  initials   text,
  role       text not null default 'viewer'
               check (role in ('gp', 'associate', 'analyst', 'viewer')),
  created_at timestamptz default now()
);

-- Trigger: auto-create a profile row whenever a new auth user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, initials, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'initials', ''),
    coalesce(new.raw_user_meta_data->>'role', 'viewer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();


-- 2. Add visibility column to tasks
-- ------------------------------------------------------------
alter table tasks
  add column if not exists visibility text not null default 'team'
    check (visibility in ('team', 'personal'));


-- 3. Add created_by column to tasks (FK to auth.users)
-- ------------------------------------------------------------
alter table tasks
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Trigger: auto-set created_by to the current auth user on insert
create or replace function set_task_created_by()
returns trigger language plpgsql security definer as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger tasks_set_created_by
before insert on tasks
for each row execute procedure set_task_created_by();


-- 4. Task shares (share personal tasks with specific users)
-- ------------------------------------------------------------
create table if not exists task_shares (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  shared_with  uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (task_id, shared_with)
);

create index if not exists task_shares_task_id_idx     on task_shares(task_id);
create index if not exists task_shares_shared_with_idx on task_shares(shared_with);
