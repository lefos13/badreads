export const metadata = {
  title: "About — Badreads",
  description: "The Badreads manifesto: honest disappointment, backed by receipts.",
};

export default function AboutPage() {
  return (
    <main className="page-width policy-page">
      <span className="eyebrow mono">The manifesto</span>
      <h1>Books fail us. That is worth recording.</h1>
      <p className="hero-copy">
        Badreads is the public roast network for readers who want to explain exactly why a book did not work. Bring the sharp opinion, then bring the evidence.
      </p>

      <h2>Why Badreads exists</h2>
      <p>
        Praise has plenty of places to live. Disappointment deserves a useful archive too: a place where readers can name the broken promise, point to the page, and help the next reader decide whether the book is worth their time.
      </p>

      <h2>The scale is backwards on purpose</h2>
      <p>
        Badreads treats stars as a badness verdict, not a recommendation score. Five stars is catastrophic, while one star means the book was only barely bad. The worse the book, the higher the number.
      </p>
      <div className="stat-row">
        <div className="stat">
          <strong>1</strong>
          <span>Barely Bad</span>
        </div>
        <div className="stat">
          <strong>2</strong>
          <span>Disappointing</span>
        </div>
        <div className="stat">
          <strong>3</strong>
          <span>Painful</span>
        </div>
        <div className="stat">
          <strong>4</strong>
          <span>Awful</span>
        </div>
        <div className="stat">
          <strong>5</strong>
          <span>Catastrophic</span>
        </div>
      </div>

      <h2>Receipts before vibes</h2>
      <p>
        A roast needs a hook and receipts: specific evidence from the work that supports the verdict. Critique the prose, pacing, plot, arguments, characters, world-building, ending, or editing. Leave authors, readers, and other people alone.
      </p>

      <h2>One book, one verdict</h2>
      <p>
        Each person gets one active score-bearing roast per book. The rule keeps the signal legible, limits pile-ons, and asks for one considered argument instead of a stack of drive-by scores.
      </p>

      <h2>Independent by design</h2>
      <p>
        Badreads is an original parody brand. It is not affiliated with Goodreads, and it does not copy Goodreads wording, assets, layouts, or code. The joke is ours; the disappointment is yours.
      </p>

      <h2>Honest disappointment is valuable</h2>
      <p>
        A failed reading experience still teaches us something. Clear criticism helps readers spend their attention well, gives books a more honest public record, and makes room for the rare pleasure of being completely right about a terrible ending.
      </p>
    </main>
  );
}
