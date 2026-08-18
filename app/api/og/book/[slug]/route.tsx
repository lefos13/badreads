import { ImageResponse } from "next/og";
import { getDomainStore } from "@/src/domain/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = getDomainStore();
  const book = await store.getBookBySlug(slug);

  if (!book) {
    return new Response("Book not found", { status: 404 });
  }

  const summary = await store.getBookSummary(book.id);
  const avg = summary.average ?? "—";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#f6f4ee",
          padding: "50px 60px",
          fontFamily: "sans-serif",
          justifyContent: "space-between",
          border: "12px solid #121110",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: "#121110" }}>✳ badreads</span>
          <span
            style={{
              backgroundColor: "#ff4d2e",
              color: "#121110",
              fontWeight: 800,
              fontSize: 20,
              padding: "6px 14px",
              fontFamily: "monospace",
            }}
          >
            THE ANTI-SHELF
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <span style={{ fontSize: 22, color: "#767167", fontFamily: "monospace" }}>
            THE CASE AGAINST / {book.firstPublished ?? "UNKNOWN YEAR"}
          </span>

          <h1
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "#121110",
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: "-0.04em",
            }}
          >
            {book.title}
          </h1>

          <p style={{ fontSize: 26, color: "#45433c", margin: 0, fontWeight: 500 }}>
            By {book.authors.join(", ")}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid #121110",
            paddingTop: "20px",
          }}
        >
          <div style={{ display: "flex", gap: "30px", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: "#121110" }}>{avg} / 5</span>
              <span style={{ fontSize: 16, color: "#767167", fontFamily: "monospace" }}>BADNESS SCORE</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: "#121110" }}>{summary.count}</span>
              <span style={{ fontSize: 16, color: "#767167", fontFamily: "monospace" }}>ROASTS ON RECORD</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: "#ff4d2e" }}>{summary.worstCount}</span>
              <span style={{ fontSize: 16, color: "#767167", fontFamily: "monospace" }}>CATASTROPHIC (5★)</span>
            </div>
          </div>

          <span style={{ fontSize: 20, fontFamily: "monospace", color: "#121110" }}>
            read the receipts →
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    },
  );
}
