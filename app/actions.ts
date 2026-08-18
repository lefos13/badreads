"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FLAW_TAGS, profileDraftSchema, validateRoastDraft, type ReactionKind } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";
import { hasModeratorAccess } from "@/src/lib/authorization";
import { consumeRateLimit } from "@/src/lib/rate-limit";

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
  const book = (await store.listBooks()).find((candidate) => candidate.id === input.bookId);
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
