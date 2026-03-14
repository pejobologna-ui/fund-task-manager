-- ============================================================
-- Fund Task Manager — migration 003
-- Row Level Security policies
-- ============================================================

-- Helper: get the current user's role from profiles.
-- security definer so it bypasses RLS on profiles itself.
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;


-- ============================================================
-- PROFILES
-- ============================================================
alter table profiles enable row level security;

-- Any authenticated user can read profiles (needed to show team member names/roles in the UI)
create policy "profiles_select"
on profiles for select to authenticated
using (true);

-- Users can only update their own profile
create policy "profiles_update"
on profiles for update to authenticated
using  (id = auth.uid())
with check (id = auth.uid());


-- ============================================================
-- TASKS
-- ============================================================
alter table tasks enable row level security;

-- SELECT
-- • team task   → any authenticated user with a profile (all roles including viewer)
-- • personal task → creator OR a user who has been shared the task
create policy "tasks_select"
on tasks for select to authenticated
using (
  (
    visibility = 'team'
    and get_my_role() in ('gp', 'associate', 'analyst', 'viewer')
  )
  or
  (
    visibility = 'personal'
    and (
      created_by = auth.uid()
      or exists (
        select 1 from task_shares
        where task_shares.task_id = tasks.id
          and task_shares.shared_with = auth.uid()
      )
    )
  )
);

-- INSERT
-- • team task   → gp / associate / analyst only (not viewer)
-- • personal task → gp / associate / analyst only (created_by is auto-set by trigger)
create policy "tasks_insert"
on tasks for insert to authenticated
with check (
  get_my_role() in ('gp', 'associate', 'analyst')
);

-- UPDATE
-- • team task   → gp / associate / analyst
-- • personal task → creator only
create policy "tasks_update"
on tasks for update to authenticated
using (
  (visibility = 'team'     and get_my_role() in ('gp', 'associate', 'analyst'))
  or
  (visibility = 'personal' and created_by = auth.uid())
)
with check (
  (visibility = 'team'     and get_my_role() in ('gp', 'associate', 'analyst'))
  or
  (visibility = 'personal' and created_by = auth.uid())
);

-- DELETE
-- • team task   → gp / associate / analyst
-- • personal task → creator only
create policy "tasks_delete"
on tasks for delete to authenticated
using (
  (visibility = 'team'     and get_my_role() in ('gp', 'associate', 'analyst'))
  or
  (visibility = 'personal' and created_by = auth.uid())
);


-- ============================================================
-- TASK_SHARES
-- ============================================================
alter table task_shares enable row level security;

-- SELECT → task creator or the user the task was shared with
create policy "task_shares_select"
on task_shares for select to authenticated
using (
  shared_with = auth.uid()
  or exists (
    select 1 from tasks
    where tasks.id = task_shares.task_id
      and tasks.created_by = auth.uid()
  )
);

-- INSERT → only the task creator can share their personal task
create policy "task_shares_insert"
on task_shares for insert to authenticated
with check (
  exists (
    select 1 from tasks
    where tasks.id = task_shares.task_id
      and tasks.created_by = auth.uid()
      and tasks.visibility = 'personal'
  )
);

-- DELETE → only the task creator can revoke a share
create policy "task_shares_delete"
on task_shares for delete to authenticated
using (
  exists (
    select 1 from tasks
    where tasks.id = task_shares.task_id
      and tasks.created_by = auth.uid()
  )
);
