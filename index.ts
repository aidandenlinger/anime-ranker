import { getRanking } from "./anilist.ts";

console.log(await getRanking("Frieren"));
console.log(await getRanking("asdfjasdfjajsdfjasdf"));
