import comp from "string-comparison";

// Threshold at which we can determine two strings as similar enough
// to be correct
// Experimentally determined via test suite
const THRESHOLD = 0.85;

/**
 * Determine how similar two titles are to each other.
 * @param title1 The first title to compare
 * @param title2 The second title to compare
 * @returns if the strings are similar or not
 */
export function titleSimilarity(
  title1: string,
  title2: string,
): "similar" | "not similar" {
  return comp.levenshtein.similarity(title1, title2) >= THRESHOLD
    ? "similar"
    : "not similar";
}
