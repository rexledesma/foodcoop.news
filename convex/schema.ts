import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  memberProfiles: defineTable({
    userId: v.string(), // Links to Better Auth user
    memberId: v.string(), // Member ID (scanned or manually entered)
    memberName: v.string(), // Name (editable by user)
    passSerialNumber: v.string(), // UUID for future .pkpass
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_memberId", ["memberId"]),
});
