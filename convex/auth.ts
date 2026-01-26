import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { v } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;
export const authComponent = createClient<DataModel>(components.betterAuth);

// Internal mutation to create member profile, called from database hook
export const createMemberProfileForUser = internalMutation({
  args: {
    userId: v.string(),
    memberId: v.optional(v.string()),
    memberName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if profile already exists (idempotent)
    const existing = await ctx.db
      .query("memberProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      return existing._id; // Profile already exists, nothing to do
    }

    const now = Date.now();
    return await ctx.db.insert("memberProfiles", {
      userId: args.userId,
      memberId: args.memberId ?? "",
      memberName: args.memberName,
      passSerialNumber: crypto.randomUUID(),
      calendarId: crypto.randomUUID(),
      jobFilters: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // Cast to action context for runMutation access in database hooks
  // This is safe because createAuth is only called from HTTP actions
  const actionCtx = ctx as GenericActionCtx<DataModel>;

  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Auto-create member profile when user signs up
            // Call internal mutation to create member profile
            await actionCtx.runMutation(
              internal.auth.createMemberProfileForUser,
              {
                userId: user.id,
                memberId: (user as { memberId?: string }).memberId ?? "",
                memberName: user.name,
              }
            );
          },
        },
      },
    },
    plugins: [convex({ authConfig })],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => authComponent.getAuthUser(ctx),
});

export const checkEmailExists = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const result = await ctx.runQuery(
      components.betterAuth.adapter.findOne,
      {
        model: "user",
        where: [{ field: "email", operator: "eq", value: args.email }],
      }
    );
    return { exists: result !== null };
  },
});
