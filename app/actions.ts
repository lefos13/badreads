"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { FLAW_TAGS, profileDraftSchema, validateRoastDraft, type ReactionKind } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";
import { canDeleteCommunityBook, canEditCommunityBook, hasModeratorAccess } from "@/src/lib/authorization";
import { checkIsbnAvailability } from "@/src/catalog/service";
import { consumeRateLimit } from "@/src/lib/rate-limit";
import { auth, getLatestDevMagicLink } from "@/src/lib/auth";

export type RoastActionState = {
  ok: boolean;
  message: string;
  roastId?: string;
};

function isFlawTag(value: string): value is (typeof FLAW_TAGS)[number] {
  return (FLAW_TAGS as readonly string[]).includes(value);
}

/*
 * Server actions are the mutation boundary for the web app. They authenticate
 * every write, validate browser-controlled values again, and return messages
 * that are safe to render without exposing persistence or provider details.
 */

async function viewerId() {
  const session = await getSession();
  return session?.user?.id ?? null;
}

const reactionInputSchema = z.object({ roastId: z.string().min(1).max(120), kind: z.enum(["FAIR", "FUNNY"]), active: z.boolean() });
const bookmarkInputSchema = z.object({ roastId: z.string().min(1).max(120), active: z.boolean() });
const followInputSchema = z.object({ followeeId: z.string().min(1).max(120), active: z.boolean() });
const reportInputSchema = z.object({ roastId: z.string().min(1).max(120), category: z.enum(["PERSONAL_ATTACK", "HATE", "SPOILER", "SPAM", "COPYRIGHT", "OTHER"]), note: z.string().trim().max(500).optional() });
const moderationInputSchema = z.object({ roastId: z.string().min(1).max(120), decision: z.enum(["APPROVE", "REJECT", "RESTORE", "REMOVE", "WARN", "SUSPEND", "BAN"]), note: z.string().trim().max(500).optional() });
const reportResolutionSchema = z.object({ reportId: z.string().min(1).max(120), status: z.enum(["UPHELD", "DISMISSED"]), note: z.string().trim().max(500).optional() });

export async function submitRoastAction(_previous: RoastActionState, formData: FormData): Promise<RoastActionState> {
  if (process.env.POSTING_ENABLED === "false") return { ok: false, message: "Posting is paused while the moderators catch up." };
  const userId = await viewerId();
  if (!userId) return { ok: false, message: "Sign in with your private email before publishing a roast." };
  const rateLimit = await consumeRateLimit(`roast:${userId}`, 10, 60 * 60 * 1000);
  if (!rateLimit.allowed) return { ok: false, message: "You have reached the hourly roast limit. Try again later." };

  const input = {
    userId,
    bookId: String(formData.get("bookId") ?? ""),
    hook: String(formData.get("hook") ?? ""),
    body: String(formData.get("body") ?? ""),
    rating: Number(formData.get("rating") ?? 0),
    flawTags: formData.getAll("flawTags").map(String).filter(isFlawTag),
    spoiler: formData.get("spoiler") === "on",
  };
  const validation = validateRoastDraft(input);
  if (!validation.success) return { ok: false, message: validation.errors.join(" ") };

  const store = getDomainStore();
  const result = await store.createRoast(input);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/");
  revalidatePath("/feed");
  const book = await store.getBook(input.bookId);
  revalidatePath(`/books/${book?.slug ?? ""}`);
  return {
    ok: true,
    roastId: result.data.id,
    message: result.data.status === "PENDING_REVIEW" ? "Roast received. A moderator will read your first one before it goes live." : "Roast published. The book has been warned.",
  };
}

export async function setReactionAction(input: { roastId: string; kind: ReactionKind; active: boolean }) {
  const parsed = reactionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: "That reaction could not be understood." };
  const userId = await viewerId();
  if (!userId) return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in before reacting." };
  const rateLimit = await consumeRateLimit(`reaction:${userId}`, 120, 60 * 1000);
  if (!rateLimit.allowed) return { ok: false as const, code: "RATE_LIMITED" as const, message: "You are reacting too quickly. Try again in a minute." };
  const result = await getDomainStore().setReaction({ ...parsed.data, userId });
  if (!result.ok) return result;
  revalidatePath("/feed");
  revalidatePath(`/roasts/${parsed.data.roastId}`);
  return result;
}

export async function setBookmarkAction(input: { roastId: string; active: boolean }) {
  const parsed = bookmarkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: "That bookmark could not be understood." };
  const userId = await viewerId();
  if (!userId) return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in before saving a roast." };
  const rateLimit = await consumeRateLimit(`bookmark:${userId}`, 60, 60 * 60 * 1000);
  if (!rateLimit.allowed) return { ok: false as const, code: "RATE_LIMITED" as const, message: "You have reached the hourly save limit." };
  const result = await getDomainStore().setBookmark({ ...parsed.data, userId });
  if (!result.ok) return result;
  revalidatePath("/feed");
  return result;
}

export async function setFollowAction(input: { followeeId: string; active: boolean }) {
  const parsed = followInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: "That follow request could not be understood." };
  const userId = await viewerId();
  if (!userId) return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in before following a reviewer." };
  return getDomainStore().setFollow({ ...parsed.data, followerId: userId });
}

export async function reportRoastAction(input: { roastId: string; category: "PERSONAL_ATTACK" | "HATE" | "SPOILER" | "SPAM" | "COPYRIGHT" | "OTHER"; note?: string }) {
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: "Choose a report reason and keep the note under 500 characters." };
  const userId = await viewerId();
  if (!userId) return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in before reporting a roast." };
  const rateLimit = await consumeRateLimit(`report:${userId}`, 10, 60 * 60 * 1000);
  if (!rateLimit.allowed) return { ok: false as const, code: "RATE_LIMITED" as const, message: "You have reached the hourly report limit." };
  const result = await getDomainStore().reportRoast({ ...parsed.data, reporterId: userId });
  if (!result.ok) return result;
  revalidatePath("/feed");
  revalidatePath(`/roasts/${parsed.data.roastId}`);
  return result;
}

export async function moderateRoastAction(input: { roastId: string; decision: "APPROVE" | "REJECT" | "RESTORE" | "REMOVE" | "WARN" | "SUSPEND" | "BAN"; note?: string }) {
  const parsed = moderationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: "That moderation action could not be understood." };
  if (!(await hasModeratorAccess())) return { ok: false as const, code: "FORBIDDEN" as const, message: "Moderator access is required." };
  const userId = await viewerId();
  if (!userId) return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in before moderating." };
  const result = await getDomainStore().moderateRoast({ ...parsed.data, moderatorId: userId });
  if (!result.ok) return result;
  revalidatePath("/feed");
  revalidatePath("/moderation");
  return result;
}

export async function resolveReportAction(input: { reportId: string; status: "UPHELD" | "DISMISSED"; note?: string }) {
  const parsed = reportResolutionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: "That report resolution could not be understood." };
  if (!(await hasModeratorAccess())) return { ok: false as const, code: "FORBIDDEN" as const, message: "Moderator access is required." };
  const userId = await viewerId();
  if (!userId) return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in before moderating." };
  const result = await getDomainStore().resolveReport({ ...parsed.data, moderatorId: userId });
  if (!result.ok) return result;
  revalidatePath("/moderation");
  revalidatePath("/feed");
  return result;
}

export type ProfileActionState = {
  ok: boolean;
  message: string;
};

export async function createProfileAction(_previous: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  if (process.env.REGISTRATION_ENABLED === "false") return { ok: false, message: "Registration is currently paused." };
  const userId = await viewerId();
  if (!userId) return { ok: false, message: "Open the sign-in link first, then choose your public handle." };
  const parsed = profileDraftSchema.safeParse({
    handle: String(formData.get("handle") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    ageConfirmed: formData.get("ageConfirmed") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((issue) => issue.message).join(" ") };

  const result = await getDomainStore().createProfile({
    userId,
    handle: parsed.data.handle,
    displayName: parsed.data.displayName,
    bio: parsed.data.bio,
    ageConfirmedAt: new Date().toISOString(),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/u/${result.data.handle}`);
  return { ok: true, message: "Your byline is ready. You can publish your first roast now." };
}

export type AccountActionState = {
  ok: boolean;
  message: string;
};

export async function deleteAccountAction(_previous: AccountActionState): Promise<AccountActionState> {
  const userId = await viewerId();
  if (!userId) return { ok: false, message: "Sign in before deleting your account." };
  const result = await getDomainStore().deleteProfile(userId);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/");
  revalidatePath("/feed");
  return { ok: true, message: "Your public profile and roasts have been deleted from this workspace." };
}

export type CommunityBookActionState = {
  ok: boolean;
  message: string;
  bookSlug?: string;
  providerWorkId?: string;
};

const MAX_COVER_DATA_BYTES = 100 * 1024; // 100KB max for stored cover data

async function processUploadedCover(coverDataUrlOrFile: unknown): Promise<string | null> {
  if (!coverDataUrlOrFile) {
    return null;
  }

  // Case 1: String (e.g. downscaled base64 data URL from client canvas)
  if (typeof coverDataUrlOrFile === "string") {
    const trimmed = coverDataUrlOrFile.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^data:(image\/(?:jpeg|png|webp|avif|gif));base64,(.+)$/i);
    if (!match) {
      throw new Error("Invalid cover image format. Only WebP, JPEG, and PNG images are supported.");
    }
    const base64Data = match[2];
    const approxBinaryBytes = Math.ceil((base64Data.length * 3) / 4);
    if (approxBinaryBytes > MAX_COVER_DATA_BYTES) {
      throw new Error("Cover image is too large (max 100KB after compression).");
    }
    return trimmed;
  }

  // Case 2: File object (e.g. direct upload fallback)
  if (typeof coverDataUrlOrFile === "object" && coverDataUrlOrFile instanceof File) {
    if (coverDataUrlOrFile.size === 0) {
      return null;
    }
    if (coverDataUrlOrFile.size > MAX_COVER_DATA_BYTES) {
      throw new Error("Cover image must be 100KB or smaller.");
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
    if (!allowedTypes.includes(coverDataUrlOrFile.type)) {
      throw new Error("Cover image must be a JPEG, PNG, WebP, or GIF file.");
    }
    const arrayBuffer = await coverDataUrlOrFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${coverDataUrlOrFile.type};base64,${base64}`;
  }

  return null;
}

export async function createCommunityBookAction(
  _previous: CommunityBookActionState,
  formData: FormData,
): Promise<CommunityBookActionState> {
  const userId = await viewerId();
  if (!userId) {
    return { ok: false, message: "Sign in before adding a book to Badreads." };
  }

  const rateLimit = await consumeRateLimit(`create-book:${userId}`, 20, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { ok: false, message: "You have reached the hourly book creation limit." };
  }

  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawAuthors = String(formData.get("authors") ?? "")
    .split(/[,;\n]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  const rawIsbn = String(formData.get("isbn") ?? "").trim();
  const rawYear = String(formData.get("firstPublished") ?? "").trim();
  const firstPublished = rawYear ? Number.parseInt(rawYear, 10) : null;
  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawCoverTone = String(formData.get("coverTone") ?? "acid");
  const coverTone = rawCoverTone === "coral" || rawCoverTone === "acid" || rawCoverTone === "lavender" || rawCoverTone === "ink"
    ? rawCoverTone
    : "acid";

  let coverUrl: string | null = null;
  try {
    const coverPayload = formData.get("coverDataUrl") || formData.get("coverImage");
    coverUrl = await processUploadedCover(coverPayload);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invalid cover image file." };
  }

  if (!rawTitle) {
    return { ok: false, message: "Title is required." };
  }
  if (rawAuthors.length === 0) {
    return { ok: false, message: "Add at least one author." };
  }

  const availability = await checkIsbnAvailability(rawIsbn);
  if (availability.status === "INVALID_ISBN") {
    return { ok: false, message: availability.message };
  }
  if (availability.status === "LOCAL_EXISTS") {
    return {
      ok: false,
      message: `A book with ISBN ${availability.isbn} is already in Badreads ("${availability.book.title}").`,
      bookSlug: availability.book.slug,
    };
  }
  if (availability.status === "OPEN_LIBRARY_EXISTS") {
    return {
      ok: false,
      message: `This book was found in Open Library ("${availability.result.title}"). Import it directly instead.`,
      providerWorkId: availability.result.providerWorkId,
      bookSlug: availability.result.slug,
    };
  }

  const store = getDomainStore();
  const result = await store.createCommunityBook({
    title: rawTitle,
    authors: rawAuthors,
    isbn: availability.isbn,
    firstPublished: Number.isFinite(firstPublished) ? firstPublished : null,
    description: rawDescription,
    coverTone,
    coverUrl,
    createdByUserId: userId,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/books/${result.data.slug}`);
  return {
    ok: true,
    message: "Community book created successfully!",
    bookSlug: result.data.slug,
  };
}

export async function updateCommunityBookAction(
  _previous: CommunityBookActionState,
  formData: FormData,
): Promise<CommunityBookActionState> {
  const userId = await viewerId();
  if (!userId) {
    return { ok: false, message: "Sign in before editing book details." };
  }

  const bookId = String(formData.get("bookId") ?? "").trim();
  if (!bookId) {
    return { ok: false, message: "Book ID is required." };
  }

  const store = getDomainStore();
  const book = await store.getBook(bookId);
  if (!book) {
    return { ok: false, message: "Book not found." };
  }

  const authorized = await canEditCommunityBook(book);
  if (!authorized) {
    return { ok: false, message: "You do not have permission to edit this book." };
  }

  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawAuthors = String(formData.get("authors") ?? "")
    .split(/[,;\n]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  const rawYear = String(formData.get("firstPublished") ?? "").trim();
  const firstPublished = rawYear ? Number.parseInt(rawYear, 10) : null;
  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawCoverTone = String(formData.get("coverTone") ?? book.coverTone);
  const coverTone = rawCoverTone === "coral" || rawCoverTone === "acid" || rawCoverTone === "lavender" || rawCoverTone === "ink"
    ? rawCoverTone
    : book.coverTone;

  let coverUrl: string | null = book.coverUrl ?? null;
  const coverPayload = formData.get("coverDataUrl") || formData.get("coverImage");
  const hasCoverPayload =
    coverPayload &&
    (typeof coverPayload === "string"
      ? coverPayload.trim().length > 0
      : coverPayload instanceof File && coverPayload.size > 0);
  if (hasCoverPayload) {
    try {
      coverUrl = await processUploadedCover(coverPayload);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Invalid cover image file." };
    }
  }

  const result = await store.updateCommunityBook({
    id: book.id,
    title: rawTitle,
    authors: rawAuthors,
    firstPublished: Number.isFinite(firstPublished) ? firstPublished : null,
    description: rawDescription,
    coverTone,
    coverUrl,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/books/${book.slug}`);
  revalidatePath(`/books/${book.slug}/edit`);
  return {
    ok: true,
    message: "Book details updated successfully.",
    bookSlug: book.slug,
  };
}

export async function deleteCommunityBookAction(
  bookIdInput: string | FormData,
): Promise<{ ok: boolean; message: string }> {
  const userId = await viewerId();
  if (!userId) {
    return { ok: false, message: "Sign in before deleting community books." };
  }

  const bookId = typeof bookIdInput === "string"
    ? bookIdInput.trim()
    : String(bookIdInput.get("bookId") ?? "").trim();

  if (!bookId) {
    return { ok: false, message: "Book ID is required." };
  }

  const store = getDomainStore();
  const book = await store.getBook(bookId);
  if (!book) {
    return { ok: false, message: "Book not found." };
  }

  const authorized = await canDeleteCommunityBook(book);
  if (!authorized) {
    return { ok: false, message: "You do not have permission to delete this book." };
  }

  const result = await store.deleteCommunityBook(book.id);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/community");
  revalidatePath("/search");
  revalidatePath("/bottom-100");
  revalidatePath(`/books/${book.slug}`);

  return { ok: true, message: "Community book entry deleted." };
}
export async function requestDevBypassMagicLinkAction(email: string = "lefterisevagelinos1996@gmail.com") {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, message: "Dev bypass is disabled in production." };
  }

  try {
    const targetEmail = email.trim().toLowerCase();
    let reqHeaders: Headers;
    try {
      reqHeaders = await headers();
    } catch {
      reqHeaders = new Headers();
    }
    await auth.api.signInMagicLink({
      body: {
        email: targetEmail,
        callbackURL: "/write",
      },
      headers: reqHeaders,
    });

    const entry = getLatestDevMagicLink(targetEmail);
    return {
      ok: true,
      url: entry?.url ?? null,
      message: `Magic link generated for ${targetEmail}.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate bypass magic link.";
    return { ok: false, message: msg };
  }
}
