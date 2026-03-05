-- Function to efficiently count conversations per tier for a given user
-- Used by the /api/conversations endpoint for tier filter chips

CREATE OR REPLACE FUNCTION count_conversation_tiers(p_user_id UUID)
RETURNS TABLE(tier TEXT, count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    opportunity_tier AS tier,
    COUNT(*)::BIGINT AS count
  FROM conversations
  WHERE user_id = p_user_id
  GROUP BY opportunity_tier;
$$;
