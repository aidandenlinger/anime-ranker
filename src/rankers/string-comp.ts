import comp from "string-comparison";

// Threshold at which we can determine two strings as similar enough
// to be correct
// Experimentally determined via test suite
const THRESHOLD = 0.9;

/**
 * Determine how similar two titles are to each other.
 * @param title_1 The first title to compare
 * @param title_2 The second title to compare
 * @returns if the strings are similar or not
 */
export function title_similarity(
  title_1: string,
  title_2: string,
): "similar" | "not similar" {
  return comp.levenshtein.similarity(title_1, title_2) >= THRESHOLD
    ? "similar"
    : "not similar";
}
