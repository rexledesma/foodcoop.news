import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const createMemberProfile = mutation({
  args: {
    memberId: v.string(),
    memberName: v.string(),
    passSerialNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check if profile already exists - return existing ID (idempotent)
    const existing = await ctx.db
      .query("memberProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("memberProfiles", {
      userId: user._id,
      memberId: args.memberId,
      memberName: args.memberName,
      passSerialNumber: args.passSerialNumber,
      calendarId: crypto.randomUUID(),
      jobFilters: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateMemberProfile = mutation({
  args: {
    memberId: v.optional(v.string()),
    memberName: v.optional(v.string()),
    jobFilters: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (!profile) {
      throw new Error("Member profile not found");
    }

    const updates: Partial<{
      memberId: string;
      memberName: string;
      jobFilters: string[];
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };

    if (args.memberId !== undefined) {
      updates.memberId = args.memberId;
    }
    if (args.memberName !== undefined) {
      updates.memberName = args.memberName;
    }
    if (args.jobFilters !== undefined) {
      updates.jobFilters = args.jobFilters;
    }

    await ctx.db.patch(profile._id, updates);
    return profile._id;
  },
});

export const getProfileByCalendarId = query({
  args: {
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_calendarId", (q) => q.eq("calendarId", args.calendarId))
      .first();
  },
});

export const getMemberProfile = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await authComponent.getAuthUser(ctx);
      if (!user) {
        return null;
      }

      return await ctx.db
        .query("memberProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();
    } catch {
      // User is not authenticated
      return null;
    }
  },
});

