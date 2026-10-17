export interface NormalizedSkillResult {
  displayName: string;
  normalizedName: string;
}

/**
 * Normalizes a single skill name:
 * - Trims leading and trailing whitespace.
 * - Discards empty strings.
 * - Computes lowercase normalizedName for canonical case-insensitive matching.
 */
export function normalizeSkillName(raw: string): NormalizedSkillResult | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalizedName = trimmed.toLowerCase();

  return {
    displayName: trimmed,
    normalizedName,
  };
}

/**
 * Normalizes a list of skill names:
 * - Trims whitespace and discards blanks.
 * - Deduplicates identical normalized names (preserving the first encountered display casing).
 */
export function normalizeSkillList(rawList: string[]): NormalizedSkillResult[] {
  if (!rawList || !Array.isArray(rawList)) {
    return [];
  }

  const seen = new Set<string>();
  const results: NormalizedSkillResult[] = [];

  for (const item of rawList) {
    const normalized = normalizeSkillName(item);
    if (!normalized) {
      continue;
    }

    if (!seen.has(normalized.normalizedName)) {
      seen.add(normalized.normalizedName);
      results.push(normalized);
    }
  }

  return results;
}
