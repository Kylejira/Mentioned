-- ============================================
-- SCAN HISTORY TABLE
-- Stores scan results over time for progress tracking
-- ============================================

-- Create scan_history table
create table if not exists scan_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  product_url text not null,
  product_name text not null,
  category text,
  score integer not null,
  mention_rate integer not null,
  top_3_rate integer not null,
  avg_position numeric(3,1),
  chatgpt_score integer,
  claude_score integer,
  chatgpt_mentioned boolean,
  claude_mentioned boolean,
  scanned_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Index for fast lookups by user and URL
create index if not exists scan_history_user_url_idx on scan_history(user_id, product_url);

-- Index for fast lookups by scan date
create index if not exists scan_history_scanned_at_idx on scan_history(scanned_at desc);

-- Enable Row Level Security
alter table scan_history enable row level security;

-- Policy: Users can only view their own scan history
create policy "Users can view own scan history"
  on scan_history for select
  using (auth.uid() = user_id);

-- Policy: Users can only insert their own scans
create policy "Users can insert own scans"
  on scan_history for insert
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own scans
create policy "Users can delete own scans"
  on scan_history for delete
  using (auth.uid() = user_id);
