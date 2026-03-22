import { v } from 'convex/values';

import { internalQuery, mutation, query } from './_generated/server';
import { authComponent } from './auth';

export const savePushSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error('Not authenticated');
    }

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
        userId: user._id,
      });
      return;
    }

    await ctx.db.insert('pushSubscriptions', {
      userId: user._id,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: Date.now(),
    });
  },
});

export const deletePushSubscription = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error('Not authenticated');
    }

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (existing && existing.userId === user._id) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getUserPushSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await authComponent.getAuthUser(ctx);
      if (!user) {
        return [];
      }

      const subscriptions = await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', user._id))
        .collect();

      return subscriptions.map((s) => ({
        endpoint: s.endpoint,
        createdAt: s.createdAt,
      }));
    } catch {
      return [];
    }
  },
});

export const getUserPushSubscriptionsWithKeys = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await authComponent.getAuthUser(ctx);
      if (!user) {
        return [];
      }

      const subscriptions = await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', user._id))
        .collect();

      return subscriptions.map((s) => ({
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
      }));
    } catch {
      return [];
    }
  },
});

export const getPushSubscriptionsByUserIds = internalQuery({
  args: {
    userIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const uniqueUserIds = new Set(args.userIds);
    if (uniqueUserIds.size === 0) {
      return [];
    }

    const endpointSet = new Set<string>();
    const subscriptions: Array<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = [];

    for (const userId of uniqueUserIds) {
      const userSubscriptions = await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect();

      for (const subscription of userSubscriptions) {
        if (endpointSet.has(subscription.endpoint)) {
          continue;
        }
        endpointSet.add(subscription.endpoint);
        subscriptions.push({
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        });
      }
    }

    return subscriptions;
  },
});
