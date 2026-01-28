/**
 * Calculate Jaccard similarity between two texts.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Tokenize text into a set of normalized words.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

/**
 * Calculate n-gram similarity for better detection of rearranged text.
 */
export function ngramSimilarity(
  text1: string,
  text2: string,
  n: number = 3
): number {
  const ngrams1 = getNgrams(text1.toLowerCase(), n);
  const ngrams2 = getNgrams(text2.toLowerCase(), n);

  if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

  const intersection = new Set([...ngrams1].filter((ng) => ngrams2.has(ng)));
  const union = new Set([...ngrams1, ...ngrams2]);

  return intersection.size / union.size;
}

function getNgrams(text: string, n: number): Set<string> {
  const ngrams = new Set<string>();
  const cleaned = text.replace(/\s+/g, ' ').trim();

  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.add(cleaned.slice(i, i + n));
  }

  return ngrams;
}

/**
 * Combined similarity score using both Jaccard and n-gram methods.
 */
export function combinedSimilarity(text1: string, text2: string): number {
  const jaccard = jaccardSimilarity(text1, text2);
  const ngram = ngramSimilarity(text1, text2);

  // Weight: 60% Jaccard (word-level), 40% n-gram (character-level)
  return jaccard * 0.6 + ngram * 0.4;
}
