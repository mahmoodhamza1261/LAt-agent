import { Plugin } from "@elizaos/core";
import { createForumPostAction } from "./actions/createForumPost";
import { initializeForumEnvironment } from "./setupEnvironment";
import { ForumClientInterface } from "./client";

// Initialize environment when the module loads
initializeForumEnvironment();

export const forumPlugin: Plugin = {
    name: "forum",
    description: "Forum API plugin for Eliza",
    actions: [createForumPostAction],
    evaluators: [],
    providers: [],
    clients: [ForumClientInterface],
};

export default forumPlugin;
