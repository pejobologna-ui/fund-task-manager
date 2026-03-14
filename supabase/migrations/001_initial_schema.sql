-- ============================================================
-- Fund Task Manager — initial schema
-- ============================================================

-- Users (team members)
create table if not exists users (
  id        text primary key,          -- short code, e.g. 'PB'
  name      text not null,
  initials  text not null,
  role      text not null,
  created_at timestamptz default now()
);

-- Categories
create table if not exists categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  color     text,                       -- optional hex colour for future UI
  created_at timestamptz default now()
);

-- Threads  (deal / project streams)
create table if not exists threads (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  color     text,
  created_at timestamptz default now()
);

-- Companies  (portfolio co, prospect, or fund-level)
create table if not exists companies (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  type      text not null check (type in ('portfolio', 'prospect', 'general')),
  created_at timestamptz default now()
);

-- Tasks
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  status       text not null default 'Open'
                 check (status in ('Open', 'In Progress', 'In Review', 'Done')),
  priority     text not null default 'Medium'
                 check (priority in ('High', 'Medium', 'Low')),
  due_date     date,
  notes        text default '',
  category_id  uuid references categories(id) on delete set null,
  thread_id    uuid references threads(id)    on delete set null,
  company_id   uuid references companies(id)  on delete set null,
  assignee_id  text references users(id)      on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
before update on tasks
for each row execute procedure set_updated_at();

-- Task activity log
create table if not exists task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  action     text not null,              -- e.g. 'created', 'status_changed', 'note_added'
  actor_id   text references users(id)  on delete set null,
  payload    jsonb,                       -- optional structured data (old/new values)
  created_at timestamptz default now()
);

-- Indexes for common query patterns
create index if not exists tasks_status_idx      on tasks(status);
create index if not exists tasks_assignee_idx    on tasks(assignee_id);
create index if not exists tasks_category_idx    on tasks(category_id);
create index if not exists tasks_due_date_idx    on tasks(due_date);
create index if not exists activity_task_id_idx  on task_activity(task_id);
