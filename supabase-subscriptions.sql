-- ============================================
-- STRIPE SUBSCRIPTION TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- Add subscription fields to brands table
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS free_scan_used boolean DEFAULT false;

-- Create subscriptions table for detailed tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  plan text NOT NULL, -- 'starter', 'pro_monthly', 'pro_annual'
  status text NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  scans_used_this_period integer DEFAULT 0,
  scans_limit integer, -- 10 for starter, NULL for pro (unlimited)
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_id_idx ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON subscriptions(stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to increment scan count
CREATE OR REPLACE FUNCTION increment_scan_count(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE subscriptions 
  SET scans_used_this_period = scans_used_this_period + 1,
      updated_at = now()
  WHERE user_id = p_user_id 
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reset scan counts (called by webhook on new billing period)
CREATE OR REPLACE FUNCTION reset_scan_count(p_stripe_subscription_id text)
RETURNS void AS $$
BEGIN
  UPDATE subscriptions 
  SET scans_used_this_period = 0,
      updated_at = now()
  WHERE stripe_subscription_id = p_stripe_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
