import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

export const toggleFavorite = mutation({
  args: {
    itemName: v.string(),
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

    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }

    await ctx.db.insert('produceFavorites', {
      userId: user._id,
      itemName: args.itemName,
      createdAt: Date.now(),
    });
    return { favorited: true };
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
