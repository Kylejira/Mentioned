-- ============================================
-- USER CHECKLIST TABLE
-- Stores AI visibility checklist progress per user
-- ============================================

-- Create user_checklist table
create table if not exists user_checklist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  completed_items text[] default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for fast lookups by user
create index if not exists user_checklist_user_id_idx on user_checklist(user_id);

-- Enable Row Level Security
alter table user_checklist enable row level security;

-- Policy: Users can only view their own checklist
create policy "Users can view own checklist"
  on user_checklist for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own checklist
create policy "Users can insert own checklist"
  on user_checklist for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own checklist
create policy "Users can update own checklist"
  on user_checklist for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own checklist
create policy "Users can delete own checklist"
  on user_checklist for delete
  using (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at on changes
drop trigger if exists update_user_checklist_updated_at on user_checklist;
create trigger update_user_checklist_updated_at
  before update on user_checklist
  for each row
  execute function update_updated_at_column();
