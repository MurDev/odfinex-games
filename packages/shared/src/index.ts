import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  version: z.string(),
  db: z.enum(["connected", "disconnected"]).optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Public player profile exposed to games via SDK */
export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  email: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const CreateLaunchRequestSchema = z.object({
  clientId: z.string().min(1),
});

export type CreateLaunchRequest = z.infer<typeof CreateLaunchRequestSchema>;

export const CreateLaunchResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  clientId: z.string(),
  launchUrl: z.string().url(),
});

export type CreateLaunchResponse = z.infer<typeof CreateLaunchResponseSchema>;

export const SessionResponseSchema = z.object({
  user: UserSchema,
  clientId: z.string(),
  expiresAt: z.string().datetime(),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const GameClientSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  launchUrl: z.string().url(),
  isActive: z.boolean(),
});

export type GameClient = z.infer<typeof GameClientSchema>;

export const GamesListResponseSchema = z.object({
  games: z.array(GameClientSchema),
});

export type GamesListResponse = z.infer<typeof GamesListResponseSchema>;
