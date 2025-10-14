import { type TestContext, suite, test } from "node:test";
import { titleSimilarity } from "./string-comp.ts";

suite("string comparison", () => {
  test("Different, but similar string", (t) => {
    similar(
      t,
      "Fate/Stay Night: Heaven's Feel I. Presage Flower",
      "Fate/stay night [Heaven's Feel] I. presage flower",
    );
    similar(
      t,
      "Fate/stay night [Unlimited Blade Works]",
      "Fate/stay night: Unlimited Blade Works",
    );
    similar(t, "Terraformars", "Terra Formars");
    similar(t, "Bullet Bullet", "BULLET/BULLET");
  });

  test("Changes punctuation", (t) => {
    similar(t, "Naruto Shippuden", "Naruto: Shippuden");
    similar(t, "Tsukimichi: Moonlit Fantasy", "TSUKIMICHI -Moonlit Fantasy-");
    similar(t, "Bakuman", "Bakuman.");
  });

  test("Changes capitalization", (t) => {
    similar(t, "Belle", "BELLE");
    similar(t, "Reborn!", "REBORN!");
    similar(t, "SAND LAND: THE SERIES", "Sand Land: The Series");
  });

  test("Not similar strings", (t) => {
    notSimilar(t, "Tokyo Vice", "The Tokyo Project");
    notSimilar(t, "RWBY", "RWBY: Ice Queendom");
    notSimilar(t, "Terraformars", "Terra Formars: Revenge");
  });
});

/**
 * Asserts that the two strings are similar.
 * @param t The test context to assert in
 * @param string1 First string to compare
 * @param string2 Second string to compare
 * @throws {import("node:assert").AssertionError} if strings are not similar
 */
function similar(t: TestContext, string1: string, string2: string) {
  t.assert.deepStrictEqual(titleSimilarity(string1, string2), "similar");
}

/**
 * Asserts that the two strings are not similar.
 * @param t The test context to assert in
 * @param string1 First string to compare
 * @param string2 Second string to compare
 * @throws {import("node:assert").AssertionError} if strings are similar
 */
function notSimilar(t: TestContext, string1: string, string2: string) {
  t.assert.deepStrictEqual(titleSimilarity(string1, string2), "not similar");
}
