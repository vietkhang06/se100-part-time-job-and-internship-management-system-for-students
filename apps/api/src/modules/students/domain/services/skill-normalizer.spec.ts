import {
  normalizeSkillName,
  normalizeSkillList,
} from './skill-normalizer';

describe('SkillNormalizer (W2-DB-01 Skill Normalization Rules)', () => {
  describe('normalizeSkillName', () => {
    it('should trim whitespace and compute lowercase normalized name', () => {
      const result = normalizeSkillName('  TypeScript  ');
      expect(result).not.toBeNull();
      expect(result!.displayName).toBe('TypeScript');
      expect(result!.normalizedName).toBe('typescript');
    });

    it('should return null for empty or whitespace-only inputs', () => {
      expect(normalizeSkillName('')).toBeNull();
      expect(normalizeSkillName('   ')).toBeNull();
      expect(normalizeSkillName(null)).toBeNull();
      expect(normalizeSkillName(undefined)).toBeNull();
    });

    it('should handle uppercase, lowercase, and mixed-case inputs consistently', () => {
      expect(normalizeSkillName('REACT')!.normalizedName).toBe('react');
      expect(normalizeSkillName('react')!.normalizedName).toBe('react');
      expect(normalizeSkillName('React')!.normalizedName).toBe('react');
    });
  });

  describe('normalizeSkillList', () => {
    it('should trim, discard blank values, and deduplicate case variations', () => {
      const input = [
        'React',
        ' react ',
        'REACT',
        '   ',
        'NestJS',
        'nestjs',
        'PostgreSQL',
      ];

      const results = normalizeSkillList(input);

      expect(results).toHaveLength(3);

      expect(results[0]).toEqual({
        displayName: 'React',
        normalizedName: 'react',
      });

      expect(results[1]).toEqual({
        displayName: 'NestJS',
        normalizedName: 'nestjs',
      });

      expect(results[2]).toEqual({
        displayName: 'PostgreSQL',
        normalizedName: 'postgresql',
      });
    });

    it('should handle empty or null array safely', () => {
      expect(normalizeSkillList([])).toEqual([]);
      expect(normalizeSkillList(null)).toEqual([]);
      expect(normalizeSkillList(undefined)).toEqual([]);
    });

    it('should preserve first encountered casing as the display name', () => {
      const results = normalizeSkillList(['Node.js', 'NODE.JS', 'node.js']);
      expect(results).toHaveLength(1);
      expect(results[0].displayName).toBe('Node.js');
      expect(results[0].normalizedName).toBe('node.js');
    });
  });
});
