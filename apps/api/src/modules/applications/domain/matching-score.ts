/** M04-04: GL-18 defines the concept, but no approved numeric formula exists. */
export type MatchingScore =
  | Readonly<{ state: 'UNAVAILABLE'; reason: 'SKILLS_MISSING' | 'FORMULA_UNAPPROVED' }>
  | Readonly<{ state: 'AVAILABLE'; value: number; formulaVersion: string }>;

/**
 * Keep the output contract explicit without inventing a scale or empty-list rule.
 * A future approved scorer can replace this function when M02/M03 supply skills.
 */
export function assessMatchingScore(input: {
  cvSkills?: readonly string[] | null;
  requiredSkills?: readonly string[] | null;
}): MatchingScore {
  if (!input.cvSkills?.length || !input.requiredSkills?.length) {
    return { state: 'UNAVAILABLE', reason: 'SKILLS_MISSING' };
  }
  return { state: 'UNAVAILABLE', reason: 'FORMULA_UNAPPROVED' };
}
