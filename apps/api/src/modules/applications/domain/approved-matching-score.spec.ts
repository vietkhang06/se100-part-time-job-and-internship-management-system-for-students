import { calculateApprovedMatchingScore as score } from './approved-matching-score';

describe('approved matching formula 1.0.0', () => {
  const requiredSkillIds = ['java', 'spring', 'sql', 'git'];
  const preferredSkillIds = ['docker', 'redis'];

  it.each([
    [['java', 'spring', 'sql', 'git', 'docker', 'redis'], 100],
    [['java', 'spring', 'sql', 'docker'], 70],
    [['java', 'spring', 'sql', 'git'], 80],
    [['docker', 'redis'], 20],
    [['photoshop'], 0],
  ] as const)('scores canonical skills deterministically', (cvSkillIds, value) => {
    const input = { cvSkillIds, requiredSkillIds, preferredSkillIds };
    expect(score(input)).toMatchObject({ state: 'AVAILABLE', value, formulaVersion: '1.0.0' });
    expect(score(input)).toEqual(score(input));
  });

  it('deduplicates and gives required skills precedence', () => {
    expect(score({ cvSkillIds: ['java', 'java'], requiredSkillIds: ['java', 'java'], preferredSkillIds: ['java', 'docker'] }))
      .toMatchObject({ value: 80, required: { matched: 1, total: 1 }, preferred: { matched: 0, total: 1 } });
  });

  it('uses required only when preferred is explicitly empty', () => {
    expect(score({ cvSkillIds: ['java', 'sql'], requiredSkillIds: ['java', 'sql', 'git'], preferredSkillIds: [] }))
      .toMatchObject({ value: 66.7 });
  });

  it('rounds half up to one decimal after summing', () => {
    const requiredSkillIds = Array.from({ length: 16 }, (_, i) => `r${i}`);
    expect(score({ cvSkillIds: requiredSkillIds.slice(0, 1), requiredSkillIds, preferredSkillIds: [] }))
      .toMatchObject({ value: 6.3 });
  });

  it('distinguishes valid empty CV, empty requirements, and invalid IDs', () => {
    expect(score({ cvSkillIds: [], cvEmptyConfirmed: true, requiredSkillIds, preferredSkillIds })).toMatchObject({ state: 'AVAILABLE', value: 0 });
    expect(score({ cvSkillIds: [], requiredSkillIds, preferredSkillIds })).toEqual({ state: 'UNAVAILABLE', reason: 'SKILLS_MISSING' });
    expect(score({ cvSkillIds: null, requiredSkillIds, preferredSkillIds })).toEqual({ state: 'UNAVAILABLE', reason: 'SKILLS_MISSING' });
    expect(score({ cvSkillIds: [], cvEmptyConfirmed: true, requiredSkillIds: [], preferredSkillIds })).toEqual({ state: 'UNAVAILABLE', reason: 'NO_REQUIRED_SKILLS' });
    expect(score({ cvSkillIds: ['java'], requiredSkillIds, preferredSkillIds: null })).toEqual({ state: 'UNAVAILABLE', reason: 'SKILLS_MISSING' });
    expect(score({ cvSkillIds: [''], requiredSkillIds, preferredSkillIds })).toEqual({ state: 'UNAVAILABLE', reason: 'INVALID_SKILL_DATA' });
  });

  it('keeps explanation stable when input order changes', () => {
    const first = score({ cvSkillIds: ['sql', 'java'], requiredSkillIds: ['java', 'sql', 'git'], preferredSkillIds: ['docker'] });
    const second = score({ cvSkillIds: ['java', 'sql'], requiredSkillIds: ['git', 'sql', 'java'], preferredSkillIds: ['docker'] });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ matchedSkillIds: ['java', 'sql'], missingSkillIds: ['docker', 'git'] });
  });
});
