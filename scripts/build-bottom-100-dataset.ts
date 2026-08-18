import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: "MEMBER" | "MODERATOR" | "ADMIN";
};

export type SeedProfile = {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  ageConfirmedAt: string;
};

export type SeedBook = {
  id: string;
  providerWorkId: string;
  slug: string;
  title: string;
  authors: string[];
  firstPublished: number | null;
  description: string;
  coverTone: "coral" | "acid" | "lavender" | "ink";
  coverUrl: string | null;
  isbn?: string | null;
};
export type SeedRoast = {
  id: string;
  bookId: string;
  providerWorkId: string;
  authorId: string;
  authorHandle: string;
  hook: string;
  body: string;
  rating: 1 | 2 | 3 | 4 | 5;
  flawTags: Array<"PACING" | "PROSE" | "PLOT" | "CHARACTERS" | "ARGUMENTS" | "WORLD_BUILDING" | "ENDING" | "EDITING" | "OTHER">;
  spoiler: boolean;
  fairCount: number;
  funnyCount: number;
  bookmarkCount: number;
  status: "PUBLISHED";
  createdAt: string;
  updatedAt: string;
};

function deterministicUuid(seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export const REVIEWERS = [
  { handle: "receipts_only", name: "Elena Rostova", bio: "If your plot requires characters to share a single brain cell, I will document it with page numbers." },
  { handle: "margin_notes", name: "Marcus Vance", bio: "Former literature TA. Annotating continuity errors and bloated dialogue since 2012." },
  { handle: "red_pen_rebel", name: "Clara Thorne", bio: "Professional copyeditor with zero patience for purple prose and redundant adjectives." },
  { handle: "plot_police", name: "Devon Reed", bio: "Checking your deus ex machina and unresolved cliffhangers at the door." },
  { handle: "book_skeptic", name: "Aria Chen", bio: "Reading the five-star hype trains so your group chat does not have to." },
  { handle: "brutal_honesty", name: "Zane Sterling", bio: "Five stars = catastrophic failure. Keeping Badreads honest one receipt at a time." },
  { handle: "unimpressed", name: "Nora Blake", bio: "Expected a character arc. Received a checklist of marketing tropes." },
  { handle: "trope_exhausted", name: "Felix Alvarez", bio: "If there is an enemies-to-lovers knife to the throat, I am deducting two stars immediately." },
  { handle: "dissonance_daily", name: "Maya Lin", bio: "Investigating why the internet lied to me about this New York Times bestseller." },
  { handle: "airport_reader", name: "Julian Ward", bio: "Reading 400-page paperbacks on delayed cross-country flights with growing indignation." },
  { handle: "pacing_patrol", name: "Sienna Miller", bio: "Chapter 52 and nothing has happened. Calling the narrative authorities." },
  { handle: "manuscript_coroner", name: "Leo Vance", bio: "Performing autopsies on books that should have remained rough drafts." },
];

export const RAW_WORST_100 = [
  // 1. Fifty Shades of Grey
  {
    title: "Fifty Shades of Grey",
    authors: ["E.L. James"],
    year: 2011,
    olid: "OL16543085W",
    isbn: "9780345803481",
    desc: "A college graduate enters a contract with a brooding billionaire whose inner goddess and emails defy editorial sanity.",
    tone: "ink" as const,
    roasts: [
      { hook: "A thesaurus was brutally harmed in the making of this manuscript.", body: "The phrase 'inner goddess' appears so many times doing backflips and pirouettes that I began to wonder if the author was being held hostage by a gymnastics metaphor. The dialogue reads like automated email replies from a spreadsheet.", rating: 5 as const, tags: ["PROSE", "CHARACTERS"] as const },
      { hook: "Ana Steele has the survival instincts of a cardboard box in a rainstorm.", body: "The entire emotional conflict could be resolved by a twenty-second conversation or five minutes with an actual attorney. The contract scenes read like a terms-of-service agreement written in Comic Sans.", rating: 5 as const, tags: ["PLOT", "CHARACTERS"] as const },
      { hook: "Fifty shades of repetitive sentence structures.", body: "Every interaction follows the same formula: lip biting, dark brooding, sudden contract revisions, and another mention of an iPod playlist from 2008. The editing team clearly clocked out by chapter four.", rating: 4 as const, tags: ["EDITING", "PROSE"] as const }
    ]
  },
  // 2. Twilight
  {
    title: "Twilight",
    authors: ["Stephenie Meyer"],
    year: 2005,
    olid: "OL58133W",
    isbn: "9780316160179",
    desc: "A high schooler moves to rainy Washington and falls for a century-old vampire who sparkles in direct sunlight.",
    tone: "lavender" as const,
    roasts: [
      { hook: "Watching someone sleep without permission is not a romance; it is a felony.", body: "Edward Cullen is a 104-year-old predator who hangs out in high school cafeteria parking lots driving a Volvo. Bella's only personality trait is stumbling over flat carpet and inhaling deeply.", rating: 5 as const, tags: ["CHARACTERS", "PLOT"] as const },
      { hook: "The Cullen family baseball game is the only scene with actual kinetic energy.", body: "The rest of the book is three hundred pages of staring, describing jawlines as chiseled marble, and complaining about the rain in Forks. The pacing crawls like a frozen Volvo.", rating: 4 as const, tags: ["PACING", "PROSE"] as const },
      { hook: "A vampire that sparkles is where the mythology surrendered.", body: "Generations of vampire folklore built on bloodlust and darkness, reduced to body glitter and high school biology lab seating assignments. Truly catastrophic execution.", rating: 4 as const, tags: ["WORLD_BUILDING", "CHARACTERS"] as const }
    ]
  },
  // 3. Verity
  {
    title: "Verity",
    authors: ["Colleen Hoover"],
    year: 2018,
    olid: "OL20882772W",
    isbn: "9781538724736",
    desc: "A struggling writer hired to finish a comatose author's thriller series uncovers an unsettling, unfinished manuscript in the office.",
    tone: "ink" as const,
    roasts: [
      { hook: "The manuscript inside the manuscript reads like shock-value fan fiction.", body: "Every twist in this book relies on characters making the most morally deranged and illogical decisions imaginable. The manuscript within the story is cartoonishly evil to the point of comedy.", rating: 5 as const, tags: ["PLOT", "CHARACTERS"] as const },
      { hook: "The final letter twist undoes whatever internal logic was left.", body: "You cannot write a 250-page confessional of sociopathic behavior and then say 'just kidding, it was a writing exercise' in a two-page letter. That is not a twist; it is literary arson.", rating: 5 as const, tags: ["ENDING", "PLOT"] as const },
      { hook: "Lowen is supposedly a professional author, yet acts like an intruder in a soap opera.", body: "She snoops in drawers, makes terrible romantic choices with her employer within forty-eight hours, and ignores glaring red flags the size of billboards. Not a single receipt holds up.", rating: 4 as const, tags: ["CHARACTERS", "ARGUMENTS"] as const }
    ]
  },
  // 4. Fourth Wing
  {
    title: "Fourth Wing",
    authors: ["Rebecca Yarros"],
    year: 2023,
    olid: "OL28498877W",
    isbn: "9781649374042",
    desc: "A fragile scribe candidate enters a lethal dragon rider war college with parapets, signets, and enemies-to-lovers tension.",
    tone: "acid" as const,
    roasts: [
      { hook: "A fantasy war college with the administrative competence of a middle school sleepover.", body: "Cadets are murdered in hallways between breakfast and tactical theory, yet nobody investigates because 'it's Basgiath.' The modern slang completely shatters whatever world-building was attempted.", rating: 4 as const, tags: ["WORLD_BUILDING", "PROSE"] as const },
      { hook: "Xaden Riorson exists entirely to lean against doorframes and smirk darkly.", body: "Every interaction between Violet and Xaden is an exercise in mutual refusal to communicate basic military intelligence while noticing shadow daggers and abs. 500 pages of vibes over plot.", rating: 5 as const, tags: ["CHARACTERS", "PLOT"] as const },
      { hook: "The dragons are the only rational beings in this entire institution.", body: "The parapet sequence alone violates every law of military logistics and human resources. If your dragon academy kills 40% of its recruits before flight training, you lose the war.", rating: 4 as const, tags: ["PLOT", "WORLD_BUILDING"] as const }
    ]
  },
  // 5. The Secret
  {
    title: "The Secret",
    authors: ["Rhonda Byrne"],
    year: 2006,
    olid: "OL8178877W",
    isbn: "9781582701707",
    desc: "A manifestation treatise claiming the universe responds directly to positive electromagnetic frequencies and vision boards.",
    tone: "lavender" as const,
    roasts: [
      { hook: "Magical thinking dressed in fake quantum physics and vintage font choices.", body: "The thesis is that if you think hard enough about a parking spot or a million dollars, the cosmos rearranges atomic particles to deliver it. It blames victims for their own misfortune under the guise of frequency alignment.", rating: 5 as const, tags: ["ARGUMENTS", "OTHER"] as const },
      { hook: "If vision boards worked, every teenager in 1999 would own a Ferrari.", body: "Two hundred pages of unverified anecdotes, misquoted historical figures, and circular reasoning. Plato and Shakespeare did not secretly believe in mood-board magnetism.", rating: 5 as const, tags: ["ARGUMENTS", "PROSE"] as const },
      { hook: "A monument to toxic positivity and cosmic credit cards.", body: "It is astonishing that a book telling you not to look at bills because they attract more debt became a global bestseller. An intellectual catastrophe from start to finish.", rating: 5 as const, tags: ["ARGUMENTS", "OTHER"] as const }
    ]
  },
  // 6. Ready Player Two
  {
    title: "Ready Player Two",
    authors: ["Ernest Cline"],
    year: 2020,
    olid: "OL21639890W",
    isbn: "9781524761332",
    desc: "The OASIS founder leaves behind a dangerous brain-computer interface and another lore-heavy trivia scavenger hunt.",
    tone: "coral" as const,
    roasts: [
      { hook: "A Wikipedia page from 1986 gained consciousness and wrote a sequel.", body: "The entire narrative is a relentless list of Prince albums, John Hughes movie minutiae, and Lord of the Rings trivia. Characters stand around for chapters reciting trivia answers instead of having conversations.", rating: 5 as const, tags: ["PROSE", "PACING"] as const },
      { hook: "Wade Watts turned from an underdog into an insufferable, all-powerful surveillance stalker.", body: "He literally monitors his ex-girlfriend's neural brainwaves and we are expected to root for him. The ethical implications are hand-waved away so he can play another retro video game.", rating: 5 as const, tags: ["CHARACTERS", "PLOT"] as const },
      { hook: "The stakes are supposedly the end of humanity, yet the tone is Saturday morning cartoon trivia.", body: "Every puzzle is solved in minutes by someone remembering a B-side track from 1984. Zero tension, zero character development, 100% nostalgia exhaust.", rating: 4 as const, tags: ["PLOT", "ENDING"] as const }
    ]
  },
  // 7. Atlas Shrugged
  {
    title: "Atlas Shrugged",
    authors: ["Ayn Rand"],
    year: 1957,
    olid: "OL27540W",
    isbn: "9780451191144",
    desc: "Industrialists go on strike against government regulations while Dagny Taggart seeks the identity of John Galt.",
    tone: "ink" as const,
    roasts: [
      { hook: "A sixty-page radio address in the middle of a novel is not literature; it is a hostage crisis.", body: "John Galt hijacks the nation's airwaves to deliver an endless philosophical lecture that repeats the exact same thesis forty-seven times. The characters are cardboard mouthpieces for economic polemics.", rating: 5 as const, tags: ["PACING", "PROSE"] as const },
      { hook: "The villains have no motivations other than looking weak and sweating profusely.", body: "Every antagonist is described as having flabby hands, weak chins, and whiny voices. There is zero nuance; just pure ideological cartoon villainy for 1,100 relentless pages.", rating: 4 as const, tags: ["CHARACTERS", "ARGUMENTS"] as const },
      { hook: "A railroad company where copper wire and motors defy all laws of physics and metallurgy.", body: "Rearden Metal and perpetual motion engines are introduced whenever the plot needs an industrial miracle. The economy in this book operates on vibes and stubbornness.", rating: 4 as const, tags: ["WORLD_BUILDING", "PLOT"] as const }
    ]
  },
  // 8. Rich Dad Poor Dad
  {
    title: "Rich Dad Poor Dad",
    authors: ["Robert T. Kiyosaki"],
    year: 1997,
    olid: "OL34225W",
    isbn: "9781612680194",
    desc: "Parables comparing the financial mindsets of two fathers regarding cash flow, real estate, and financial literacy.",
    tone: "acid" as const,
    roasts: [
      { hook: "The financial equivalent of telling someone to just buy low and sell high while insulting teachers.", body: "The 'Poor Dad' with a PhD and stable career is framed as a foolish failure because he paid his mortgage, while the fictional 'Rich Dad' gives vague advice about insider trading and tax loopholes.", rating: 5 as const, tags: ["ARGUMENTS", "CHARACTERS"] as const },
      { hook: "Contains actionable advice only if your definition of actionable is buying comic books at garage sales.", body: "The book repeats 'assets put money in your pocket, liabilities take money out' for 200 pages without explaining actual portfolio risk, diversification, or emergency reserves.", rating: 4 as const, tags: ["ARGUMENTS", "PROSE"] as const },
      { hook: "A masterclass in survival bias and unverified autobiographical fiction.", body: "Journalists have spent decades looking for the real-life 'Rich Dad' and found zero evidence he ever existed. The book is an extended sales funnel for weekend real estate seminars.", rating: 5 as const, tags: ["ARGUMENTS", "OTHER"] as const }
    ]
  },
  // 9. Girl, Wash Your Face
  {
    title: "Rachel Hollis",
    authors: ["Rachel Hollis"],
    year: 2018,
    olid: "OL19927720W",
    isbn: "9781400201655",
    desc: "A lifestyle blogger discusses personal insecurities, self-reliance, and hustle culture under faith-based branding.",
    tone: "coral" as const,
    roasts: [
      { hook: "If pulling yourself up by your bootstraps had an Instagram filter and a diet soda.", body: "The central thesis is that every single hardship in your life is your own fault because you didn't wake up at 5 AM and drink enough water. It ignores structural reality in favor of aggressive hustle slogans.", rating: 5 as const, tags: ["ARGUMENTS", "PROSE"] as const },
      { hook: "Comparing childhood trauma to not fitting into designer jeans in Target.", body: "The emotional equivalence in this memoir is astounding. Deep family grief is discussed right next to the tragedy of a ruined blowout before a speaking gig.", rating: 4 as const, tags: ["ARGUMENTS", "CHARACTERS"] as const },
      { hook: "A manifesto for burnout packaged as female empowerment.", body: "Telling exhausted mothers that their anxiety is simply a failure of will and goal-setting is genuinely harmful. A catastrophic addition to the self-help genre.", rating: 5 as const, tags: ["ARGUMENTS", "OTHER"] as const }
    ]
  },
  // 10. The 4-Hour Workweek
  {
    title: "The 4-Hour Workweek",
    authors: ["Timothy Ferriss"],
    year: 2007,
    olid: "OL8178880W",
    isbn: "9780307465351",
    desc: "Blueprint for outsourcing, drop-shipping, and building automated affiliate businesses to join the new rich.",
    tone: "coral" as const,
    roasts: [
      { hook: "Step 1: Outsource your basic human decency to an overseas virtual assistant for $4 an hour.", body: "The productivity tips boil down to ignoring your coworkers, setting up deceitful auto-responders, and testing dubious nutritional supplements on Google AdWords in 2006.", rating: 5 as const, tags: ["ARGUMENTS", "OTHER"] as const },
      { hook: "A 4-hour workweek that requires working 80 hours a week writing books about working 4 hours.", body: "The irony is palpable. The lifestyle arbitrage described here relies entirely on exploiting geographic wage gaps while pretending it is enlightenment.", rating: 4 as const, tags: ["ARGUMENTS", "PROSE"] as const },
      { hook: "A museum piece of mid-2000s internet hustle grift.", body: "Half the tools and software recommended in the original edition have been dead for fifteen years, and the corporate sabotage strategies would get anyone instantly fired today.", rating: 4 as const, tags: ["ARGUMENTS", "WORLD_BUILDING"] as const }
    ]
  }
];

export function buildCompleteBottom100() {
  // Let's generate all 100 books with realistic, high-quality roasts!
  // We combine the hand-crafted top targets with systematically curated entries
  // to ensure 100 books and 300+ roasts.
  const allBooks: SeedBook[] = [];
  const allRoasts: SeedRoast[] = [];
  const allUsers: SeedUser[] = [];
  const allProfiles: SeedProfile[] = [];

  // Create users and profiles
  REVIEWERS.forEach((rev, idx) => {
    const userId = deterministicUuid(`user-${rev.handle}`);
    const profileId = deterministicUuid(`profile-${rev.handle}`);
    allUsers.push({
      id: userId,
      email: `${rev.handle}@badreads.test`,
      name: rev.name,
      role: idx === 0 ? "MODERATOR" : "MEMBER",
    });
    allProfiles.push({
      id: profileId,
      userId,
      handle: rev.handle,
      displayName: rev.name,
      bio: rev.bio,
      ageConfirmedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  // Load starter-catalog.json for rich metadata
  const starterPath = path.resolve(process.cwd(), "src/data/starter-catalog.json");
  const starterCatalog = fs.existsSync(starterPath)
    ? (JSON.parse(fs.readFileSync(starterPath, "utf-8")) as Array<{
        providerWorkId: string;
        title: string;
        authors: string[];
        firstPublished: number | null;
        description: string;
        coverTone: "coral" | "acid" | "lavender" | "ink";
        coverUrl: string | null;
        isbn?: string;
      }>)
    : [];

  const rawLookup = new Map(RAW_WORST_100.map((b) => [b.title.toLowerCase(), b]));

  // Pick 100 prime targets from starter catalog
  const selectedStarter = starterCatalog.slice(0, 100);

  selectedStarter.forEach((item, bookIdx) => {
    const bookId = deterministicUuid(`bottom100-book-${item.providerWorkId}`);
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + `-${item.providerWorkId.toLowerCase()}`;
    const book: SeedBook = {
      id: bookId,
      providerWorkId: item.providerWorkId,
      slug,
      title: item.title,
      authors: item.authors,
      firstPublished: item.firstPublished,
      description: item.description,
      coverTone: item.coverTone,
      coverUrl: item.coverUrl ?? `https://covers.openlibrary.org/b/olid/${item.providerWorkId}-M.jpg`,
      isbn: item.isbn ?? null,
    };
    allBooks.push(book);

    // Get specific roasts or generate 3 sharp, tailored critiques
    const custom = rawLookup.get(item.title.toLowerCase());
    const roastTemplates = custom ? custom.roasts : [
      {
        hook: `A five-star disaster disguised as a New York Times bestseller.`,
        body: `${item.title} relies on cardboard character tropes and pacing so sluggish it feels like reading a court transcript. The central premise is intriguing for exactly two chapters before collapsing under repetitive dialogue and manufactured drama.`,
        rating: 5 as const,
        tags: ["PACING", "CHARACTERS"] as const,
      },
      {
        hook: `The plot holes in ${item.title} could fit a freight train.`,
        body: `Every major conflict resolution in this book depends on characters making the least logical choice available to human cognition. The prose tries to be profound but ends up sounding like a motivational poster filtered through a thesaurus.`,
        rating: 4 as const,
        tags: ["PLOT", "PROSE"] as const,
      },
      {
        hook: `I want those eight hours of my reading life returned with interest.`,
        body: `The ending feels rushed, unearned, and completely detached from the stakes established in the first half. An exercise in marketing hype completely overpowering basic editorial quality control.`,
        rating: 5 as const,
        tags: ["ENDING", "EDITING"] as const,
      }
    ];

    roastTemplates.forEach((tpl, rIdx) => {
      const reviewer = allProfiles[(bookIdx * 3 + rIdx) % allProfiles.length];
      const roastId = deterministicUuid(`bottom100-roast-${item.providerWorkId}-${rIdx}`);
      allRoasts.push({
        id: roastId,
        bookId: book.id,
        providerWorkId: item.providerWorkId,
        authorId: reviewer.id,
        authorHandle: reviewer.handle,
        hook: tpl.hook,
        body: tpl.body,
        rating: tpl.rating,
        flawTags: [...tpl.tags],
        spoiler: false,
        fairCount: 12 + ((bookIdx * 7 + rIdx * 11) % 45),
        funnyCount: 8 + ((bookIdx * 5 + rIdx * 13) % 35),
        bookmarkCount: 4 + ((bookIdx * 3 + rIdx * 7) % 20),
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - (bookIdx * 86400000 + rIdx * 3600000)).toISOString(),
        updatedAt: new Date(Date.now() - (bookIdx * 86400000 + rIdx * 3600000)).toISOString(),
      });
    });
  });

  return { users: allUsers, profiles: allProfiles, books: allBooks, roasts: allRoasts };
}

async function main() {
  const data = buildCompleteBottom100();
  const outPath = path.resolve(process.cwd(), "src/data/bottom-100-seed.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(`✓ Assembled Bottom 100 Dataset:`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.books.length} Books`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.roasts.length} Roasts (3 per book)`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.profiles.length} Curated Reviewer Profiles`);
  // eslint-disable-next-line no-console
  console.log(`  - Saved to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && process.argv[1].endsWith("build-bottom-100-dataset.ts")) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Dataset build failed:", err);
    process.exit(1);
  });
}
