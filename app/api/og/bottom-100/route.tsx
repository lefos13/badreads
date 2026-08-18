import { ImageResponse } from "next/og";
import { getDomainStore } from "@/src/domain/repository";

export const runtime = "nodejs";

export async function GET() {
  const store = getDomainStore();
  const items = await store.listBottom100("badness");
  const topItems = items.slice(0, 3);

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
            DISASTER LEADERBOARD
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: 20, color: "#767167", fontFamily: "monospace" }}>
            VERIFIED CRITICISM / {items.length} OVERHYPED TITLES
          </span>
          <h1
            style={{
              fontSize: 60,
              fontWeight: 900,
              color: "#121110",
              lineHeight: 1.0,
              margin: 0,
              letterSpacing: "-0.04em",
            }}
          >
            The Bottom 100.
          </h1>
          <p style={{ fontSize: 24, color: "#45433c", margin: 0 }}>
            The 100 worst-rated bestsellers on record.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            borderTop: "2px solid #121110",
            paddingTop: "16px",
          }}
        >
          {topItems.map((item, idx) => (
            <div
              key={item.book.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 20,
              }}
            >
              <span style={{ fontWeight: 700, color: "#121110" }}>
                #{idx + 1} {item.book.title} ({item.book.authors[0]})
              </span>
              <span style={{ fontFamily: "monospace", color: "#ff4d2e", fontWeight: 700 }}>
                ★ {item.summary.average ?? "—"}/5 ({item.summary.count} roasts)
              </span>
            </div>
          ))}
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
