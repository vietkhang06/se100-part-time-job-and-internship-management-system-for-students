import { assessMatchingScore } from './matching-score';

describe('M04 matching score contract', () => {
  it('marks missing CV or job skills unavailable', () => {
    expect(assessMatchingScore({ cvSkills: [], requiredSkills: ['TypeScript'] })).toEqual({
      state: 'UNAVAILABLE', reason: 'SKILLS_MISSING',
    });
    expect(assessMatchingScore({ cvSkills: ['TypeScript'] })).toEqual({
      state: 'UNAVAILABLE', reason: 'SKILLS_MISSING',
    });
  });

  it('does not invent a numeric score when skills exist but the formula is unapproved', () => {
    expect(assessMatchingScore({ cvSkills: ['TypeScript'], requiredSkills: ['TypeScript'] })).toEqual({
      state: 'UNAVAILABLE', reason: 'FORMULA_UNAPPROVED',
    });
  });
});
