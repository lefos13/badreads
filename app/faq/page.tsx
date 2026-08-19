export const metadata = {
  title: "FAQ — Badreads",
  description: "Answers about Badreads roasts, ratings, receipts, moderation, and account controls.",
};

export default function FaqPage() {
  return (
    <main className="page-width policy-page">
      <span className="eyebrow mono">Questions, answered</span>
      <h1>The short version.</h1>
      <p className="hero-copy">Everything you need to know before assigning a catastrophic verdict.</p>

      <h2>What is Badreads?</h2>
      <p>
        Badreads is an English-first public roast network for readers who want to explain why a book failed them. Every roast pairs a hook, evidence from the work, flaw tags, a badness rating, and an optional spoiler marker.
      </p>

      <h2>Why is 5 stars the worst?</h2>
      <p>
        The rating scale measures badness, so the number rises as the reading experience gets worse. One star is Barely Bad, two is Disappointing, three is Painful, four is Awful, and five is Catastrophic.
      </p>

      <h2>What is a hook and what are receipts?</h2>
      <p>
        The hook is the short opening line that captures the roast in 10–140 characters. Receipts are the evidence that follows: the body must be 80–3,000 characters and must critique the book rather than its author or other readers.
      </p>

      <h2>What are flaw tags?</h2>
      <p>
        Flaw tags identify what went wrong. Choose one to three from Pacing, Prose, Plot, Characters, Arguments, World Building, Ending, Editing, or Other.
      </p>

      <h2>Why can I only write one roast per book per person?</h2>
      <p>
        Each person may have one active score-bearing roast for a book. That keeps a reader&apos;s verdict clear, prevents duplicate scoring, and makes the book&apos;s overall badness easier to read.
      </p>

      <h2>How do spoilers work?</h2>
      <p>
        Mark the spoiler flag when your evidence reveals plot information or an ending. The marker tells readers that the receipts may disclose story details before they open the roast.
      </p>

      <h2>How does moderation work?</h2>
      <p>
        A user&apos;s first roast goes to pending review. After it is approved, later roasts from that user can publish immediately. Three distinct user reports automatically mark a roast as removed, and roasts under review, rejected, or removed are only visible to their author and moderators.
      </p>

      <h2>Can I delete my account or export my data?</h2>
      <p>
        Yes. You can export your full account data as JSON and permanently delete your account together with its associated verdicts. Email addresses remain private and are not part of the public profile.
      </p>

      <h2>What is the Bottom 100?</h2>
      <p>
        The Bottom 100 is the board for the 100 worst-rated bestsellers on record. A title needs at least three verified roasts to qualify, and a higher badness score can displace an existing book.
      </p>

      <h2>Is Badreads affiliated with Goodreads?</h2>
      <p>
        No. Badreads is an independent, original parody brand. It is not affiliated with Goodreads and does not copy its wording, assets, layouts, or code.
      </p>
    </main>
  );
}
