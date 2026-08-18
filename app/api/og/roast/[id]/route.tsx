import { ImageResponse } from "next/og";
import { BADNESS_LABELS } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getDomainStore();
  const roast = await store.getRoast(id);

  if (!roast || roast.status !== "PUBLISHED") {
    return new Response("Roast not found", { status: 404 });
  }

  const book = await store.getBook(roast.bookId);
  const bookTitle = book?.title ?? "Unknown Book";
  const badnessLabel = BADNESS_LABELS[roast.rating];

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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: "#121110" }}>✳ badreads</span>
          </div>
          <div
            style={{
              display: "flex",
              backgroundColor: "#ff4d2e",
              color: "#121110",
              fontWeight: 800,
              fontSize: 20,
              padding: "6px 14px",
              fontFamily: "monospace",
            }}
          >
            5 STARS = WORST
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: 32, color: "#ff4d2e" }}>
              {"★".repeat(roast.rating)}
              {"☆".repeat(5 - roast.rating)}
            </span>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: "#121110" }}>
              {badnessLabel.toUpperCase()}
            </span>
          </div>

          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: "#121110",
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            &ldquo;{roast.hook}&rdquo;
          </h1>

          <p
            style={{
              fontSize: 24,
              color: "#45433c",
              lineHeight: 1.4,
              margin: 0,
              maxHeight: 100,
              overflow: "hidden",
            }}
          >
            {roast.body.slice(0, 160)}
            {roast.body.length > 160 ? "..." : ""}
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
          <div style={{ display: "flex", gap: "10px" }}>
            {roast.flawTags.map((tag) => (
              <span
                key={tag}
                style={{
                  backgroundColor: "#d5ff5f",
                  border: "1px solid #121110",
                  padding: "4px 10px",
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                {tag.replaceAll("_", " ")}
              </span>
            ))}
          </div>

          <span style={{ fontSize: 22, color: "#121110", fontWeight: 600 }}>
            @{roast.author.handle} on {bookTitle}
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
