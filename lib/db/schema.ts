import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

// ============================================
// BETTER AUTH TABLES
// ============================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// SOCIAL ACCOUNTS
// ============================================

export const socialAccount = pgTable("social_account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  platform: text("platform").notNull(), // 'twitter', 'instagram', 'tiktok', etc.
  platformUserId: text("platform_user_id").notNull(),
  platformUsername: text("platform_username").notNull(),

  accessToken: text("access_token").notNull(), // encrypted (OAuth 2.0 for most platforms, OAuth 1.0a for Twitter if no OAuth 2.0)
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),

  // OAuth 1.0a credentials (for Twitter media upload)
  oauth1AccessToken: text("oauth1_access_token"), // encrypted, OAuth 1.0a access token (separate from OAuth 2.0)
  accessTokenSecret: text("access_token_secret"), // encrypted, OAuth 1.0a access token secret

  profileImageUrl: text("profile_image_url"),
  followerCount: integer("follower_count"),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// POSTS
// ============================================

export const post = pgTable("post", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  content: text("content").notNull(),
  mediaUrls: text("media_urls").array(),

  scheduledFor: timestamp("scheduled_for"),
  status: text("status").notNull().default("draft"), // draft, scheduled, publishing, published, failed

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Junction table: which social accounts should receive each post
export const postTarget = pgTable("post_target", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => post.id, { onDelete: "cascade" }),
  socialAccountId: text("social_account_id")
    .notNull()
    .references(() => socialAccount.id, { onDelete: "cascade" }),

  status: text("status").notNull().default("pending"), // pending, publishing, published, failed
  platformPostId: text("platform_post_id"), // ID returned by the platform
  publishedAt: timestamp("published_at"),
  errorMessage: text("error_message"),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof user.$inferSelect;
export type SocialAccount = typeof socialAccount.$inferSelect;
export type Post = typeof post.$inferSelect;
export type PostTarget = typeof postTarget.$inferSelect;
