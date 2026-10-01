import { levenshtein, normalize, splitVariants } from '../../lib/text';

export type AnswerLanguage = 'english' | 'other';
export type AnswerVerdict = 'exact' | 'typo' | 'wrong';

const ENGLISH_PREFIX = /^(to|a|an|the) /;

export function typoAllowance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

function withOptionalPrefix(values: string[], language: AnswerLanguage): string[] {
  const out = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    out.add(value);
    if (language === 'english') {
      const stripped = value.replace(ENGLISH_PREFIX, '');
      if (stripped) out.add(stripped);
    }
  }
  return [...out];
}

export function checkAnswer(given: string, expected: string, language: AnswerLanguage): AnswerVerdict {
  const answer = normalize(given);
  if (!answer) return 'wrong';
  const candidates = withOptionalPrefix([expected, ...splitVariants(expected)].map(normalize), language);
  const answers = withOptionalPrefix([answer], language);

  if (answers.some((a) => candidates.includes(a))) return 'exact';

  for (const candidate of candidates) {
    const allowance = typoAllowance(candidate.length);
    if (allowance === 0) continue;
    if (answers.some((a) => levenshtein(a, candidate) <= allowance)) return 'typo';
  }
  return 'wrong';
}
