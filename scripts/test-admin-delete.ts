
import { describe, expect, it } from "vitest";
import { canDeleteCommunityBook, hasAdminAccess } from "../src/lib/authorization";
import type { BookWork } from "../src/domain/types";

describe("admin community book deletion", () => {
  const rathBook: BookWork = {
    id: "4ec9ce1d-11a5-4b6e-b063-bd857164a720",
    slug: "το-πεπρωμένο-του-ραθ-community-9789606072598",
    title: "Το πεπρωμένο του Ραθ",
    authors: ["Λευτέρης Ευαγγελινός"],
    firstPublished: null,
    description: "",
    isCommunityAdded: true,
    sourceId: "community-9789606072598",
    coverTone: "coral"
  };

  it("identifies community book and allows deletion by admin", async () => {
    // In demo mode or for admin
    const canDel = await canDeleteCommunityBook(rathBook);
    expect(canDel).toBe(true);
  });
});
