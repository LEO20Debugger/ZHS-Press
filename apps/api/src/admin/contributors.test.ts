import { describe, expect, it } from 'vitest';
import { attachContributorSchema } from '@zhs/shared';
import { slugifyName } from './contributors.service';

describe('slugifyName', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyName('Ada Okonkwo')).toBe('ada-okonkwo');
  });

  it('keeps accented letters as their base letter rather than dropping them', () => {
    // Naively stripping non-ASCII would turn "Chinụa" into "china" or "chinа",
    // which is both wrong and a different person's slug.
    expect(slugifyName('Chinụa Achebe')).toBe('chinua-achebe');
    expect(slugifyName('Émile Zola')).toBe('emile-zola');
    expect(slugifyName('Ngũgĩ wa Thiong’o')).toBe('ngugi-wa-thiongo');
  });

  it('drops apostrophes rather than turning them into hyphens', () => {
    // "o-brien" reads as two names; "obrien" is the convention.
    expect(slugifyName("O'Brien")).toBe('obrien');
    expect(slugifyName('O’Brien')).toBe('obrien');
  });

  it('collapses punctuation and trims stray hyphens', () => {
    expect(slugifyName('  A. B.  Carter—Smith  ')).toBe('a-b-carter-smith');
    expect(slugifyName('!!!')).toBe('contributor');
  });

  it('never returns an empty slug', () => {
    // The column is NOT NULL and unique; an empty string would collide with
    // the next nameless case rather than fail cleanly.
    expect(slugifyName('')).toBe('contributor');
    expect(slugifyName('   ')).toBe('contributor');
  });

  it('stays within the column length', () => {
    expect(slugifyName('a'.repeat(400)).length).toBeLessThanOrEqual(150);
  });
});

describe('attachContributorSchema', () => {
  it('accepts an existing contributor by id', () => {
    const result = attachContributorSchema.safeParse({ contributorId: 4, role: 'author' });
    expect(result.success).toBe(true);
  });

  it('accepts a new name', () => {
    const result = attachContributorSchema.safeParse({ name: 'Ada Okonkwo' });
    expect(result.success).toBe(true);
    // The role has a default, so the picker can omit it.
    if (result.success) expect(result.data.role).toBe('contributor');
  });

  it('refuses both an id and a name', () => {
    /*
     * The two mean different things — attach this person, versus create one —
     * and silently preferring one would be the wrong call half the time. The
     * UI clears the typed name when a suggestion is picked; this is the check
     * that the API does not depend on it having done so.
     */
    const result = attachContributorSchema.safeParse({ contributorId: 4, name: 'Ada' });
    expect(result.success).toBe(false);
  });

  it('refuses neither', () => {
    expect(attachContributorSchema.safeParse({ role: 'author' }).success).toBe(false);
  });

  it('rejects a role outside the enum', () => {
    // The column is an ENUM; an unknown value is a database error otherwise.
    expect(attachContributorSchema.safeParse({ name: 'A', role: 'typesetter' }).success).toBe(
      false,
    );
  });

  it('normalises a blank piece title to undefined', () => {
    const result = attachContributorSchema.safeParse({ name: 'A', pieceTitle: '   ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pieceTitle).toBeUndefined();
  });

  it('accepts every role the schema allows', () => {
    for (const role of ['author', 'illustrator', 'editor', 'contributor']) {
      expect(attachContributorSchema.safeParse({ name: 'A', role }).success, role).toBe(true);
    }
  });
});
