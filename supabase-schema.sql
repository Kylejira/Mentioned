-- Mentioned Database Schema
-- Run this SQL in your Supabase dashboard: SQL Editor > New Query

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- Brands (one per user for now)
create table brands (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  url text not null,
  description text,
  category text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Competitors (linked to brand)
create table competitors (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now()
);

-- Scans (visibility check results)
create table scans (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete cascade,
  status text not null, -- 'not_mentioned', 'low_visibility', 'recommended'
  sources jsonb, -- { chatgpt: {...}, claude: {...} }
  queries_tested jsonb,
  signals jsonb,
  actions jsonb,
  competitor_results jsonb,
  raw_responses jsonb, -- For debugging: stores full AI responses
  created_at timestamp with time zone default now()
);

-- Migration for existing tables: add raw_responses column
-- ALTER TABLE scans ADD COLUMN IF NOT EXISTS raw_responses jsonb;

-- Enable Row Level Security
alter table brands enable row level security;
alter table competitors enable row level security;
alter table scans enable row level security;

-- Policies: users can only access their own data
create policy "Users can view own brands" on brands for select using (auth.uid() = user_id);
create policy "Users can insert own brands" on brands for insert with check (auth.uid() = user_id);
create policy "Users can update own brands" on brands for update using (auth.uid() = user_id);
create policy "Users can delete own brands" on brands for delete using (auth.uid() = user_id);

create policy "Users can view own competitors" on competitors for select using (brand_id in (select id from brands where user_id = auth.uid()));
create policy "Users can insert own competitors" on competitors for insert with check (brand_id in (select id from brands where user_id = auth.uid()));
create policy "Users can delete own competitors" on competitors for delete using (brand_id in (select id from brands where user_id = auth.uid()));

create policy "Users can view own scans" on scans for select using (brand_id in (select id from brands where user_id = auth.uid()));
create policy "Users can insert own scans" on scans for insert with check (brand_id in (select id from brands where user_id = auth.uid()));

-- Create updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add trigger to brands table
create trigger update_brands_updated_at
  before update on brands
  for each row
  execute function update_updated_at_column();
