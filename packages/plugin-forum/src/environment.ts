import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const forumEnvSchema = z.object({
    FORUM_API_BASE_URL: z.string().min(1, "Forum API base URL is required"),
    FORUM_ACCESS_TOKEN: z.string().min(1, "Forum access token is required"),
    FORUM_REFRESH_TOKEN: z.string().min(1, "Forum refresh token is required"),
    ENABLE_FORUM_POST_GENERATION: z.string().optional().transform(val => val === "true"),
    FORUM_POST_INTERVAL_MIN: z.string().optional().transform(val => parseInt(val || "90", 10)),
    FORUM_POST_INTERVAL_MAX: z.string().optional().transform(val => parseInt(val || "180", 10)),
});

export type ForumConfig = z.infer<typeof forumEnvSchema>;

export async function validateForumConfig(
    runtime: IAgentRuntime
): Promise<ForumConfig> {
    try {
        const config = {
            FORUM_API_BASE_URL: process.env.FORUM_API_BASE_URL || runtime.getSetting("FORUM_API_BASE_URL"),
            FORUM_ACCESS_TOKEN: process.env.FORUM_ACCESS_TOKEN || runtime.getSetting("FORUM_ACCESS_TOKEN"),
            FORUM_REFRESH_TOKEN: process.env.FORUM_REFRESH_TOKEN || runtime.getSetting("FORUM_REFRESH_TOKEN"),
            ENABLE_FORUM_POST_GENERATION: process.env.ENABLE_FORUM_POST_GENERATION || runtime.getSetting("ENABLE_FORUM_POST_GENERATION") || "false",
            FORUM_POST_INTERVAL_MIN: process.env.FORUM_POST_INTERVAL_MIN || runtime.getSetting("FORUM_POST_INTERVAL_MIN") || "90",
            FORUM_POST_INTERVAL_MAX: process.env.FORUM_POST_INTERVAL_MAX || runtime.getSetting("FORUM_POST_INTERVAL_MAX") || "180",
        };
        
        return forumEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Forum API configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
