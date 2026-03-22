import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

export const setFavorite = mutation({
  args: {
    itemName: v.string(),
    favorited: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error('Not authenticated');
    }

    const existing = await ctx.db
      .query('produceFavorites')
      .withIndex('by_userId_itemName', (q) =>
        q.eq('userId', user._id).eq('itemName', args.itemName),
      )
      .first();

    if (args.favorited) {
      if (existing) {
        return { favorited: true };
      }
      await ctx.db.insert('produceFavorites', {
        userId: user._id,
        itemName: args.itemName,
        createdAt: Date.now(),
      });
      return { favorited: true };
    }

    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }

    return { favorited: false };
  },
});

export const getUserFavorites = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await authComponent.getAuthUser(ctx);
      if (!user) {
        return [];
      }

      const favorites = await ctx.db
        .query('produceFavorites')
        .withIndex('by_userId', (q) => q.eq('userId', user._id))
        .collect();

      return favorites.map((f) => f.itemName);
    } catch {
      return [];
    }
  },
});

export const getFavoriteCounts = query({
  args: {
    itemNames: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const filterNames = args.itemNames ? new Set(args.itemNames) : null;
    const favorites = await ctx.db.query('produceFavorites').collect();
    const counts: Record<string, number> = {};

    for (const favorite of favorites) {
      if (filterNames && !filterNames.has(favorite.itemName)) {
        continue;
      }
      counts[favorite.itemName] = (counts[favorite.itemName] ?? 0) + 1;
    }

    return counts;
  },
});
