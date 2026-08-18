import { notFound, redirect } from "next/navigation";
import { resolveCatalogWork } from "@/src/catalog/service";
import { getDomainStore } from "@/src/domain/repository";

type CatalogChoosePageProps = { searchParams: Promise<{ providerWorkId?: string }> };

export const dynamic = "force-dynamic";
const COVER_TONES = ["coral", "acid", "lavender", "ink"] as const;

function determineCoverTone(providerWorkId: string): (typeof COVER_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < providerWorkId.length; i++) {
    hash = (hash * 31 + providerWorkId.charCodeAt(i)) >>> 0;
  }
  return COVER_TONES[hash % COVER_TONES.length];
}

function slugify(title: string, providerWorkId: string) {
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return `${titleSlug || "book"}-${providerWorkId.toLowerCase()}`;
}
export default async function CatalogChoosePage({ searchParams }: CatalogChoosePageProps) {
  const { providerWorkId } = await searchParams;
  if (!providerWorkId || !/^OL\d+W$/i.test(providerWorkId)) notFound();
  const result = await resolveCatalogWork(providerWorkId.toUpperCase());
  if (!result) notFound();

  const book = await getDomainStore().upsertBook({
    id: `book-${result.providerWorkId.toLowerCase()}`,
    slug: "slug" in result && typeof result.slug === "string" ? result.slug : slugify(result.title, result.providerWorkId),
    title: result.title,
    authors: result.authors.length ? result.authors : ["Unknown author"],
    firstPublished: result.firstPublished,
    description: "Catalog record imported from Open Library. Add the first evidence-backed verdict.",
    coverTone: determineCoverTone(result.providerWorkId),
    sourceId: result.providerWorkId,
  });
  redirect(`/books/${book.slug}`);
}
