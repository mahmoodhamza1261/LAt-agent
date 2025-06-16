import { elizaLogger, type Client, type IAgentRuntime } from "@elizaos/core";
import { ForumPostClient } from "./post";
import { validateForumConfig } from "./environment";

export class ForumClient implements Client {
  name = "forum";
  private runtime: IAgentRuntime;
  private postClient: ForumPostClient | null = null;

  async start(runtime: IAgentRuntime) {
    elizaLogger.info("Starting forum client");
    this.runtime = runtime;

    try {
      // Validate config first
      await validateForumConfig(runtime);

      // Initialize post client
      this.postClient = new ForumPostClient(runtime);
      await this.postClient.init();

      elizaLogger.success("Forum client started successfully");
      return this;
    } catch (error) {
      elizaLogger.error("Error starting forum client:", error);
      // Return a partially initialized client that will still work for manual posts
      return this;
    }
  }

  async stop() {
    elizaLogger.info("Stopping forum client");
    if (this.postClient) {
      this.postClient.stop();
    }
  }

  async createPost(title?: string, description?: string): Promise<any> {
    if (this.postClient) {
      return this.postClient.createPost(title, description);
    } else {
      elizaLogger.error("Post client not initialized");
      return Promise.reject(new Error("Post client not initialized"));
    }
  }
}

// Client interface for Eliza
export const ForumClientInterface: Client = {
  name: "forum",
  config: {},
  start: async (runtime: IAgentRuntime) => {
    const client = new ForumClient();
    return client.start(runtime);
  }
};

export default ForumClientInterface;
