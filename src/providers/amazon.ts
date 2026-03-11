import type { Media, Provider } from "./provider.ts";

/** Provider of a **static** list of media labeled Anime on Amazon Prime. */
export class AmazonPrime implements Provider {
  /** Human-readable identifier for AmazonPrime */
  readonly name = "AmazonPrime";

  /** Not really an API, but the url where they show media labeled anime */
  readonly api = new URL("https://www.amazon.com/gp/video/genre/anime");

  /** Prints a warning that this provider does not update itself */
  constructor() {
    console.log(
      "WARNING: AmazonPrime shows require a **manual** refresh! See documentation for more info",
    );
  }

  /**
   * @returns a **static** list of anime on Amazon. Must be updated manually :(
   */
  getMedia() {
    return Promise.resolve([...this.shows, ...this.movies]);
  }

  // https://www.amazon.com/gp/video/genre/anime - Prime shows labeled "Anime".
  // Click on TV Shows -> View More
  // Scroll to bottom of page
  // Run in browser console:
  // Array.from(document.querySelectorAll('div>ul article')).map((u) => ({providerTitle: u.attributes["data-card-title"].nodeValue, providerURL: u.querySelector('a').href}))
  /** Static list of shows on Amazon. Last updaed 3/10/26 */
  readonly shows = [
    {
      providerTitle: "The Darwin Incident",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FZLTGVZD/ref=atv_br_def_r_br_c_unkc_1_1",
    },
    {
      providerTitle: "From Old Country Bumpkin to Master Swordsman",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0D8Z9C7Z3/ref=atv_br_def_r_br_c_unkc_1_2",
    },
    {
      providerTitle: "Murder Drones - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DZHBVTP5/ref=atv_br_def_r_br_c_unkc_1_3",
    },
    {
      providerTitle: "Ghost Stories (English Dubbed) - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DNHRH7JW/ref=atv_br_def_r_br_c_unkc_1_4",
    },
    {
      providerTitle: "Übel Blatt",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DSJQKQG5/ref=atv_br_def_r_br_c_unkc_1_5",
    },
    {
      providerTitle: "Mobile Suit Gundam GQuuuuuuX",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CY9Q3TVR/ref=atv_br_def_r_br_c_unkc_1_6",
    },
    {
      providerTitle: "TOUGEN ANKI",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DMF12ZD2/ref=atv_br_def_r_br_c_unkc_1_7",
    },
    {
      providerTitle: "Strike World: Deadverse Reloaded the Anime",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0G6XG9WGP/ref=atv_br_def_r_br_c_unkc_1_8",
    },
    {
      providerTitle: "Tatsuki Fujimoto 17-26",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FYR75NCL/ref=atv_br_def_r_br_c_unkc_1_9",
    },
    {
      providerTitle: "Dororo",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FM8WLQJR/ref=atv_br_def_r_br_c_unkc_1_10",
    },
    {
      providerTitle: "SANDA",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FMYY26G7/ref=atv_br_def_r_br_c_unkc_1_11",
    },
    {
      providerTitle: "Alan's Universe",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F8JPBX4S/ref=atv_br_def_r_br_c_unkc_1_12",
    },
    {
      providerTitle: "Umamusume: Cinderella Gray",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F2XRQTHP/ref=atv_br_def_r_br_c_unkc_1_13",
    },
    {
      providerTitle: "Death Note (Japanese Language with English Subtitles)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B6P4Z169/ref=atv_br_def_r_br_c_unkc_1_14",
    },
    {
      providerTitle: "A Star Brighter Than the Sun",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FMNSP9HJ/ref=atv_br_def_r_br_c_unkc_1_15",
    },
    {
      providerTitle: "Speed Racer - The Complete Series",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CJC4GM6X/ref=atv_br_def_r_br_c_unkc_1_16",
    },
    {
      providerTitle: "VINLAND SAGA",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CH1MMR34/ref=atv_br_def_r_br_c_unkc_1_17",
    },
    {
      providerTitle: "BANANA FISH",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DKBZ3XYD/ref=atv_br_def_r_br_c_unkc_1_18",
    },
    {
      providerTitle: "Kyo Kara Maoh! (English Dubbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0D1H5LL3D/ref=atv_br_def_r_br_c_unkc_1_19",
    },
    {
      providerTitle: "Ninja Vs. Gokudo",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FNZS5MT9/ref=atv_br_def_r_br_c_unkc_1_20",
    },
    {
      providerTitle: "April Showers Bring May Flowers",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0G4FHCC83/ref=atv_br_def_r_br_c_JdoyERsmr_1_21",
    },
    {
      providerTitle: "There's No Freaking Way I'll be Your Lover! Unless...",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0GGTPR5Z2/ref=atv_br_def_r_br_c_JdoyERsmr_1_22",
    },
    {
      providerTitle: "Hell Teacher: Jigoku Sensei Nube",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0G916MW4J/ref=atv_br_def_r_br_c_JdoyERsmr_1_23",
    },
    {
      providerTitle: "YOUR FORMA",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DW3YW162/ref=atv_br_def_r_br_c_JdoyERsmr_1_24",
    },
    {
      providerTitle: "Blade of the Immortal",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07YTN1SH8/ref=atv_br_def_r_br_c_JdoyERsmr_1_25",
    },
    {
      providerTitle: "Fermat Kitchen",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FS5KDWDZ/ref=atv_br_def_r_br_c_JdoyERsmr_1_26",
    },
    {
      providerTitle:
        "Hakugei: Legend of the Moby Dick (English Dubbed) - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B09KGP85GL/ref=atv_br_def_r_br_c_JdoyERsmr_1_27",
    },
    {
      providerTitle: "CITY THE ANIMATION Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F2GYBXR5/ref=atv_br_def_r_br_c_JdoyERsmr_1_28",
    },
    {
      providerTitle: "Angel Cop",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FL1KRCCJ/ref=atv_br_def_r_br_c_JdoyERsmr_1_29",
    },
    {
      providerTitle: "My Deer Friend Nokotan - S01",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0D3KRGXR6/ref=atv_br_def_r_br_c_JdoyERsmr_1_30",
    },
    {
      providerTitle: "The Dinner Table Detective",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DJWZ8V6R/ref=atv_br_def_r_br_c_JdoyERsmr_1_31",
    },
    {
      providerTitle: "Shaman King Flowers",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0D7YNZ2LQ/ref=atv_br_def_r_br_c_JdoyERsmr_1_32",
    },
    {
      providerTitle: "Yu-Gi-Oh! 5D's",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B00S65VCZS/ref=atv_br_def_r_br_c_JdoyERsmr_1_33",
    },
    {
      providerTitle: "Tokyo Magnitude 8.0 (English Dubbed) - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DYJKFK66/ref=atv_br_def_r_br_c_JdoyERsmr_1_34",
    },
    {
      providerTitle: "Journal of the Mysterious Creatures",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DJ8ZLFPR/ref=atv_br_def_r_br_c_JdoyERsmr_1_35",
    },
    {
      providerTitle: "Inuyasha Season - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CGVBDRC4/ref=atv_br_def_r_br_c_JdoyERsmr_1_36",
    },
    {
      providerTitle: "Magilumiere Magical Girls Inc.",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DDJ1ND3F/ref=atv_br_def_r_br_c_JdoyERsmr_1_37",
    },
    {
      providerTitle: "Edens Zero - Season 02",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B8KW6HM4/ref=atv_br_def_r_br_c_JdoyERsmr_1_38",
    },
    {
      providerTitle: "Monsuno",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CBMHWKH9/ref=atv_br_def_r_br_c_JdoyERsmr_1_39",
    },
    {
      providerTitle: "Great Teacher Onizuka",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07HSQRBJW/ref=atv_br_def_r_br_c_JdoyERsmr_1_40",
    },
    {
      providerTitle:
        "Yashahime: Princess Half-Demon (Japanese with English Subs) - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FQN8HTY3/ref=atv_br_def_r_br_c_JdoyERsmr_1_41",
    },
    {
      providerTitle: "Goku Midnight Eye",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DH3B2PDT/ref=atv_br_def_r_br_c_JdoyERsmr_1_42",
    },
    {
      providerTitle: "Yu-Gi-Oh! Zexal",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DH39PRJB/ref=atv_br_def_r_br_c_JdoyERsmr_1_43",
    },
    {
      providerTitle: "Cyborg 009: The Cyborg Soldier",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CX42ZG3K/ref=atv_br_def_r_br_c_JdoyERsmr_1_44",
    },
    {
      providerTitle: "Pon No Michi",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FBSF4HHP/ref=atv_br_def_r_br_c_JdoyERsmr_1_45",
    },
    {
      providerTitle: "Key the Metal Idol",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B8RQWX15/ref=atv_br_def_r_br_c_JdoyERsmr_1_46",
    },
    {
      providerTitle: "Tonbo!",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F21THRW9/ref=atv_br_def_r_br_c_JdoyERsmr_1_47",
    },
    {
      providerTitle: "Photon the Idiot Adventures: Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B7CD98W8/ref=atv_br_def_r_br_c_JdoyERsmr_1_48",
    },
    {
      providerTitle: "Earl & Fairy",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07XG2F2T7/ref=atv_br_def_r_br_c_JdoyERsmr_1_49",
    },
    {
      providerTitle: "Bartender: Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B08TGSC9S3/ref=atv_br_def_r_br_c_JdoyERsmr_1_50",
    },
    {
      providerTitle: "BABYLON",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DMGT9CRM/ref=atv_br_def_r_br_c_JdoyERsmr_1_51",
    },
    {
      providerTitle: "Aliens vs. Shinnosuke",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B09WZL4S3K/ref=atv_br_def_r_br_c_JdoyERsmr_1_52",
    },
    {
      providerTitle: "Tokyo Magnitude 8.0 (Original Japanese) - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F399KT57/ref=atv_br_def_r_br_c_JdoyERsmr_1_53",
    },
    {
      providerTitle: "High School! KIMENGUMI",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0GFGT1WGV/ref=atv_br_def_r_br_c_JdoyERsmr_1_54",
    },
    {
      providerTitle: "Love Hina Again (English Dubbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CWSFZ3ZS/ref=atv_br_def_r_br_c_JdoyERsmr_1_55",
    },
    {
      providerTitle: "Yu-Gi-Oh! VRAINS",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B7F4Z9ZR/ref=atv_br_def_r_br_c_JdoyERsmr_1_56",
    },
    {
      providerTitle: "Library Wars",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DLWLXZFV/ref=atv_br_def_r_br_c_JdoyERsmr_1_57",
    },
    {
      providerTitle: "Tetsujin 28 (2004)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B08LMLX73S/ref=atv_br_def_r_br_c_JdoyERsmr_1_58",
    },
    {
      providerTitle: "Yu-Gi-Oh! SEVENS - Season 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0D5RP166Q/ref=atv_br_def_r_br_c_JdoyERsmr_1_59",
    },
    {
      providerTitle: "pet",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F8VN8ZTQ/ref=atv_br_def_r_br_c_JdoyERsmr_1_60",
    },
    {
      providerTitle: "All Purpose Cultural Cat Girl Nuku Nuku (English Dubbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CW53XYKW/ref=atv_br_def_r_br_c_JdoyERsmr_1_61",
    },
    {
      providerTitle: "After the Rain",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FYZV3SZ5/ref=atv_br_def_r_br_c_JdoyERsmr_1_62",
    },
    {
      providerTitle: "Tales Of Little Women",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DMLG2D4D/ref=atv_br_def_r_br_c_JdoyERsmr_1_63",
    },
    {
      providerTitle: "Thermae Romae (English Dubbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CVK2XCX6/ref=atv_br_def_r_br_c_JdoyERsmr_1_64",
    },
  ].map((entry) => ({
    ...entry,
    type: "TV" as const,
    provider: "AmazonPrime" as const,
    providerURL: new URL(entry.providerURL.replace(/\/ref=.*$/, "")),
  })) satisfies Media[];

  // https://www.amazon.com/gp/video/genre/anime - Prime shows labeled "Anime".
  // Click on Movies -> View More (or go to TV Shows, then change the filter from TV Shows to movies)
  // Scroll to bottom of page
  // Run in browser console:
  // Array.from(document.querySelectorAll('div>ul article')).map((u) => ({providerTitle: u.attributes["data-card-title"].nodeValue, providerURL: u.querySelector('a').href}))
  /** Static list of movies on Amazon. Last updaed 2/17/26 */
  readonly movies = [
    {
      providerTitle: "EVANGELION:1.11 YOU ARE (NOT) ALONE.",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FM2W6B9Y/ref=atv_br_def_r_br_c_unkc_1_1",
    },
    {
      providerTitle: "Memories",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B8KY2Q7F/ref=atv_br_def_r_br_c_unkc_1_2",
    },
    {
      providerTitle: "Street Fighter II - The Movie (English Dubbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07DV33PJ6/ref=atv_br_def_r_br_c_unkc_1_3",
    },
    {
      providerTitle: "Look Back",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DH5DFNDG/ref=atv_br_def_r_br_c_unkc_1_4",
    },
    {
      providerTitle: "Ghost in the Shell 2.0",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0BPYDCHBX/ref=atv_br_def_r_br_c_unkc_1_5",
    },
    {
      providerTitle: "EVANGELION:3.33 YOU CAN (NOT) REDO.",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DWSGRBV1/ref=atv_br_def_r_br_c_unkc_1_6",
    },
    {
      providerTitle: "The Monkey King: Reborn",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B09M8TG1J9/ref=atv_br_def_r_br_c_unkc_1_7",
    },
    {
      providerTitle: "Wicked City (English Dubbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CVHWZSJQ/ref=atv_br_def_r_br_c_unkc_1_8",
    },
    {
      providerTitle: "Maquia: When The Promised Flower Blooms",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07M71HW9S/ref=atv_br_def_r_br_c_unkc_1_9",
    },
    {
      providerTitle: "Penguin Highway",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07TMZPL29/ref=atv_br_def_r_br_c_unkc_1_10",
    },
    {
      providerTitle: "Street Fighter II - The Movie",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CTLPNCGD/ref=atv_br_def_r_br_c_unkc_1_11",
    },
    {
      providerTitle: "Yu-Gi-Oh! The Dark Side of Dimensions",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B085482SH5/ref=atv_br_def_r_br_c_unkc_1_12",
    },
    {
      providerTitle: "Demon City Shinjuku",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DQYTDDM1/ref=atv_br_def_r_br_c_unkc_1_13",
    },
    {
      providerTitle: "Half Nelson",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0GPFLPXYV/ref=atv_br_def_r_br_c_unkc_1_14",
    },
    {
      providerTitle: "In This Corner of The World (English)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B8TMCG8C/ref=atv_br_def_r_br_c_unkc_1_15",
    },
    {
      providerTitle:
        "Donten: Laughing Under the Clouds - Gaiden: Chapter 2 - The Tragedy of Fuuma Ninja Tribe",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B083N67QVY/ref=atv_br_def_r_br_c_unkc_1_16",
    },
    {
      providerTitle: "Digimon Adventure tri.: Reunion",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0773X93J8/ref=atv_br_def_r_br_c_unkc_1_17",
    },
    {
      providerTitle: "LUPIN THE 3rd vs. CAT’S EYE",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B8TJ3NM9/ref=atv_br_def_r_br_c_unkc_1_18",
    },
    {
      providerTitle: "Haikara-San: Here Comes Miss Modern Part 1",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B09CD8K5LS/ref=atv_br_def_r_br_c_unkc_1_19",
    },
    {
      providerTitle:
        "Donten: Laughing Under the Clouds - Gaiden: Chapter 3 - Conspiracy of the Military",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CNSDQ23K/ref=atv_br_def_r_br_c_unkc_1_20",
    },
    {
      providerTitle: "Gintama The Very Final [English-Language Version]",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B6JF39TL/ref=atv_br_def_r_br_c_hUhMb1smr_1_21",
    },
    {
      providerTitle: "Haikara-San: Here Comes Miss Modern: Part 2",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CGPHYWJT/ref=atv_br_def_r_br_c_hUhMb1smr_1_22",
    },
    {
      providerTitle: "A Wind Named Amnesia",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07MMP6GBX/ref=atv_br_def_r_br_c_hUhMb1smr_1_23",
    },
    {
      providerTitle: "Digimon Adventure tri. 3: Confession",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CN6PSMGN/ref=atv_br_def_r_br_c_hUhMb1smr_1_24",
    },
    {
      providerTitle: "Digimon Adventure tri.: Future",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CN94ZPQB/ref=atv_br_def_r_br_c_hUhMb1smr_1_25",
    },
    {
      providerTitle: "Nintama Rantarō: Invincible Master of the Dokutake Ninja",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FC5F7J4V/ref=atv_br_def_r_br_c_hUhMb1smr_1_26",
    },
    {
      providerTitle: "Legend of the Millennium Dragon",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B00BRAG9ES/ref=atv_br_def_r_br_c_hUhMb1smr_1_27",
    },
    {
      providerTitle: "Blue Thermal",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CWPYLVFK/ref=atv_br_def_r_br_c_hUhMb1smr_1_28",
    },
    {
      providerTitle: "Technotise: Edit & I",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0D9ZR2S1P/ref=atv_br_def_r_br_c_hUhMb1smr_1_29",
    },
    {
      providerTitle: "Project A-Ko (Original Japanese)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B083L2JHCY/ref=atv_br_def_r_br_c_hUhMb1smr_1_30",
    },
    {
      providerTitle: "Prime Rose",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B08PQ6LPP8/ref=atv_br_def_r_br_c_hUhMb1smr_1_31",
    },
    {
      providerTitle: "Swimming to Sea",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B07FHXHG2Q/ref=atv_br_def_r_br_c_hUhMb1smr_1_32",
    },
    {
      providerTitle: "The Legend of Snow White - King of the Forest",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0B12HP6X7/ref=atv_br_def_r_br_c_hUhMb1smr_1_33",
    },
    {
      providerTitle: "The Magic Lamp and the Moving Islands (Subbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FM3NLMCZ/ref=atv_br_def_r_br_c_hUhMb1smr_1_34",
    },
    {
      providerTitle: "GoShogun: The Time Etrainger",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FVG3XM8N/ref=atv_br_def_r_br_c_hUhMb1smr_1_35",
    },
    {
      providerTitle: "Project A-ko 4: FINAL",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FHP3V583/ref=atv_br_def_r_br_c_hUhMb1smr_1_36",
    },
    {
      providerTitle: "Ghost in the Shell",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0GR6LZZWP/ref=atv_br_def_r_br_c_hUhMb1smr_1_37",
    },
    {
      providerTitle: "Ne Zha",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0G33BZLF6/ref=atv_br_def_r_br_c_hUhMb1smr_1_38",
    },
    {
      providerTitle: "EVANGELION:2.22 YOU CAN (NOT) ADVANCE.",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FPM5DX4G/ref=atv_br_def_r_br_c_hUhMb1smr_1_39",
    },
    {
      providerTitle: "Appleseed",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CG5HC43S/ref=atv_br_def_r_br_c_hUhMb1smr_1_40",
    },
    {
      providerTitle: "Robot Carnival (English Dubbed)",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0C9SFHZQ9/ref=atv_br_def_r_br_c_hUhMb1smr_1_41",
    },
    {
      providerTitle: "Liz and the Blue Bird",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FPBD4FK9/ref=atv_br_def_r_br_c_hUhMb1smr_1_42",
    },
    {
      providerTitle: "Hells",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F7GWXX7H/ref=atv_br_def_r_br_c_hUhMb1smr_1_43",
    },
    {
      providerTitle: "Dead Space: Aftermath",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0DGZLNDXP/ref=atv_br_def_r_br_c_hUhMb1smr_1_44",
    },
    {
      providerTitle: "Yu-Gi-Oh! Bonds Beyond Time",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CPSSS2VZ/ref=atv_br_def_r_br_c_hUhMb1smr_1_45",
    },
    {
      providerTitle: "Project A-ko 2: Plot of the Daitokuji Financial Group",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FJD1VQ34/ref=atv_br_def_r_br_c_hUhMb1smr_1_46",
    },
    {
      providerTitle: "Digimon Adventure tri. 2: Determination",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0FBHMJS9Q/ref=atv_br_def_r_br_c_hUhMb1smr_1_47",
    },
    {
      providerTitle:
        "Sound! Euphonium: The Movie - Our Promise: A Brand New Day",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CL5CC43R/ref=atv_br_def_r_br_c_hUhMb1smr_1_48",
    },
    {
      providerTitle: "DEEMO Memorial Keys [English-Language Version]",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CLTGZSMK/ref=atv_br_def_r_br_c_hUhMb1smr_1_49",
    },
    {
      providerTitle: "Digimon Adventure tri.: Coexistence",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0F9145BTR/ref=atv_br_def_r_br_c_hUhMb1smr_1_50",
    },
    {
      providerTitle: "Mazinkaiser SKL",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B0CG5TQXB6/ref=atv_br_def_r_br_c_hUhMb1smr_1_51",
    },
    {
      providerTitle: "10 Tokyo Warriors: The Final Battle",
      providerURL:
        "https://www.amazon.com/gp/video/detail/B09RVMNJFQ/ref=atv_br_def_r_br_c_hUhMb1smr_1_52",
    },
  ].map((entry) => ({
    ...entry,
    type: "MOVIE" as const,
    provider: "AmazonPrime" as const,
    providerURL: new URL(entry.providerURL.replace(/\/ref=.*$/, "")),
  })) satisfies Media[];
}
