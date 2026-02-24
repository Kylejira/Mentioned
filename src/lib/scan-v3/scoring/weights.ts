export const SCORING_WEIGHTS = {
  position: {
    1: 1.0,
    2: 0.7,
    3: 0.5,
    4: 0.3,
  } as Record<number, number>,

  intent: {
    user_provided: 2.0,
    direct_recommendation: 1.5,
    problem_based: 1.3,
    alternatives: 1.3,
    comparison: 1.2,
    feature_based: 0.9,
    budget_based: 0.8,
  } as Record<string, number>,

  components: {
    mention_rate: 0.35,
    position: 0.35,
    intent: 0.30,
  },
} as const
