/** R-M04-03 formula 1.0.0. Inputs must be validated canonical skill IDs from a versioned catalog. */
export type ApprovedMatchingInput = Readonly<{
  cvSkillIds?: readonly string[] | null;
  requiredSkillIds?: readonly string[] | null;
  preferredSkillIds?: readonly string[] | null;
  cvEmptyConfirmed?: boolean;
}>;

export type ApprovedMatchingResult =
  | Readonly<{ state: 'UNAVAILABLE'; reason: 'SKILLS_MISSING' | 'NO_REQUIRED_SKILLS' | 'INVALID_SKILL_DATA' }>
  | Readonly<{
      state: 'AVAILABLE'; value: number; formulaVersion: '1.0.0';
      required: Readonly<{ matched: number; total: number }>;
      preferred: Readonly<{ matched: number; total: number }>;
      matchedSkillIds: readonly string[];
      missingSkillIds: readonly string[];
    }>;

export function calculateApprovedMatchingScore(input: ApprovedMatchingInput): ApprovedMatchingResult {
  const groups = [input.cvSkillIds, input.requiredSkillIds, input.preferredSkillIds];
  if (groups.some((group) => group != null && (!Array.isArray(group) || group.some((id) => typeof id !== 'string' || !id.trim())))) {
    return { state: 'UNAVAILABLE', reason: 'INVALID_SKILL_DATA' };
  }
  if (groups.some((group) => group == null) || (input.cvSkillIds!.length === 0 && !input.cvEmptyConfirmed)) {
    return { state: 'UNAVAILABLE', reason: 'SKILLS_MISSING' };
  }
  const cv = new Set(input.cvSkillIds!);
  const required = new Set(input.requiredSkillIds!);
  if (required.size === 0) return { state: 'UNAVAILABLE', reason: 'NO_REQUIRED_SKILLS' };
  const preferred = new Set(input.preferredSkillIds!.filter((id) => !required.has(id)));
  const requiredMatched = [...required].filter((id) => cv.has(id)).length;
  const preferredMatched = [...preferred].filter((id) => cv.has(id)).length;
  const requested = [...new Set([...required, ...preferred])].sort();
  const rawTenths = preferred.size
    ? 800 * requiredMatched / required.size + 200 * preferredMatched / preferred.size
    : 1000 * requiredMatched / required.size;
  return {
    state: 'AVAILABLE', value: Math.round(rawTenths) / 10, formulaVersion: '1.0.0',
    required: { matched: requiredMatched, total: required.size },
    preferred: { matched: preferredMatched, total: preferred.size },
    matchedSkillIds: requested.filter((id) => cv.has(id)),
    missingSkillIds: requested.filter((id) => !cv.has(id)),
  };
}
