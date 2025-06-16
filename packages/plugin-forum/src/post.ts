import { elizaLogger, type IAgentRuntime, generateText, ModelClass, composeContext, stringToUuid } from "@elizaos/core";
import { createForumService } from "./services";
import { saveTokensToFile } from "./setupEnvironment";
import { validateForumConfig } from "./environment";

// Post generation template - improved with stricter output formatting instructions
const forumPostGenerationTemplate = `
# You are {{agentName}}
{{bio}}
{{style}}

# Task:
Generate a thoughtful forum post that would be interesting to your audience.
Create content that matches your personality and interests.

# IMPORTANT OUTPUT FORMAT:
You must format your response exactly as shown below with the Title and Description clearly marked:

Title: "Your post title here"
Description: "Your detailed post content here (2-3 paragraphs)"

The title must be between quotes and should be engaging and relevant.
The description must be between quotes and should be 2-3 paragraphs of thoughtful content.
Do not include any other text, comments, or additional formatting in your response.
`;

export class ForumPostClient {
  private runtime: IAgentRuntime;
  private isPosting: boolean = false;
  private postInterval: number;
  private postIntervalMin: number;
  private postIntervalMax: number;
  private enablePostGeneration: boolean;
  private timer: NodeJS.Timeout | null = null;
  private forumService: any;
  private defaultRoomId: string;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.postIntervalMin = parseInt(this.runtime.getSetting("FORUM_POST_INTERVAL_MIN") || "90", 10) * 60 * 1000;
    this.postIntervalMax = parseInt(this.runtime.getSetting("FORUM_POST_INTERVAL_MAX") || "180", 10) * 60 * 1000;
    this.postInterval = this.getRandomInterval();
    this.enablePostGeneration = this.runtime.getSetting("ENABLE_FORUM_POST_GENERATION") === "true";
    // Create a default room ID specifically for automated posts
    this.defaultRoomId = stringToUuid(`forum-auto-${this.runtime.agentId}`);

    elizaLogger.info(`Forum post client initialized with settings:
      - Enable post generation: ${this.enablePostGeneration}
      - Post interval min: ${this.postIntervalMin / (60 * 1000)} minutes
      - Post interval max: ${this.postIntervalMax / (60 * 1000)} minutes
      - Default room ID: ${this.defaultRoomId}
    `);
  }

  public async init(): Promise<void> {
    try {
      // Initialize environment and services
      const config = await validateForumConfig(this.runtime);
      
      // Create forum service
      this.forumService = createForumService(
        config.FORUM_API_BASE_URL,
        config.FORUM_ACCESS_TOKEN,
        config.FORUM_REFRESH_TOKEN
      );

      // Ensure default room exists
      await this.ensureDefaultRoom();

      // Start posting scheduler if enabled
      if (this.enablePostGeneration) {
        elizaLogger.info("Automatic forum post generation is enabled");
        this.scheduleNextPost();
      } else {
        elizaLogger.info("Automatic forum post generation is disabled");
      }
    } catch (error) {
      elizaLogger.error("Failed to initialize forum post client:", error);
    }
  }

  private async ensureDefaultRoom(): Promise<void> {
    try {
      // Check if the room exists in DB
      const roomExists = await this.runtime.databaseAdapter?.getRoom(this.defaultRoomId);
      
      if (!roomExists) {
        elizaLogger.info(`Creating default forum room with ID: ${this.defaultRoomId}`);
        await this.runtime.databaseAdapter?.createRoom(this.defaultRoomId);
        
        // Add the agent as a participant
        await this.runtime.databaseAdapter?.addParticipant(
          this.runtime.agentId,
          this.defaultRoomId
        );
      } else {
        elizaLogger.debug(`Default forum room already exists: ${this.defaultRoomId}`);
      }
    } catch (error) {
      elizaLogger.error("Error ensuring default room exists:", error);
      // Create a fallback room ID if there was an error
      this.defaultRoomId = stringToUuid(`forum-fallback-${Date.now()}`);
      elizaLogger.info(`Created fallback room ID: ${this.defaultRoomId}`);
    }
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private getRandomInterval(): number {
    return Math.floor(Math.random() * (this.postIntervalMax - this.postIntervalMin + 1)) + this.postIntervalMin;
  }

  private scheduleNextPost(): void {
    this.postInterval = this.getRandomInterval();
    elizaLogger.info(`Scheduling next forum post in ${this.postInterval / (60 * 1000)} minutes`);
    
    this.timer = setTimeout(() => {
      this.createPost().catch((err) => {
        elizaLogger.error("Error creating forum post:", err);
      }).finally(() => {
        this.scheduleNextPost();
      });
    }, this.postInterval);
  }

  public async createPost(title?: string, description?: string): Promise<boolean> {
    if (this.isPosting) {
      elizaLogger.warn("Already creating a forum post, skipping");
      return false;
    }

    this.isPosting = true;
    try {
      // If title and description are provided directly, use them
      // Otherwise generate them
      if (!title || !description) {
        elizaLogger.info("Generating forum post content...");

        // Generate a topic to help guide the AI
        const topics = this.runtime.character.topics || [
          "Technology", "Philosophy", "Science", "Art", "Culture", "Society", "Future"
        ];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];

        // Generate post content
        const state = await this.runtime.composeState(
          { 
            content: { 
              text: `Create a new forum post about ${randomTopic}` 
            },
            userId: this.runtime.agentId,
            roomId: this.defaultRoomId,
            agentId: this.runtime.agentId
          },
          { agentName: this.runtime.character.name }
        );

        const context = composeContext({
          state,
          template: forumPostGenerationTemplate,
        });

        // Add more specific stop tokens to help formatting
        const generatedContent = await generateText({
          runtime: this.runtime,
          context,
          modelClass: ModelClass.SMALL,
          stop: ["</response>", "---", "###"],
        });

        elizaLogger.debug(`Generated raw content: ${generatedContent.substring(0, 100)}...`);

        // Extract title and description with improved regex - handles multiline descriptions
        const titleMatch = generatedContent.match(/Title:\s*["'](.+?)["']/);
        const descriptionMatch = generatedContent.match(/Description:\s*["']([\s\S]+?)["']/);

        // Enhanced error handling with fallbacks
        if (!titleMatch && !descriptionMatch) {
          elizaLogger.error("Failed to extract title or description from generated content");
          elizaLogger.debug("Full generated content:", generatedContent);
          
          // Fallback: Create generic title and use the generated content as description
          title = `${this.runtime.character.name}'s Thoughts on ${randomTopic}`;
          description = generatedContent.trim();
          elizaLogger.info(`Using fallback title and raw content as description`);
        } else {
          // Extract what we can
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
          } else {
            title = `${this.runtime.character.name}'s Thoughts on ${randomTopic}`;
            elizaLogger.info(`Using fallback title: "${title}"`);
          }
          
          if (descriptionMatch && descriptionMatch[1]) {
            description = descriptionMatch[1].trim();
          } else {
            // If we have the title pattern but not description, use everything after the title
            const afterTitle = generatedContent.split(/Title:\s*["'](.+?)["']/)[2];
            if (afterTitle) {
              description = afterTitle.replace(/^[\s\n:]*Description:\s*/i, '').trim();
              elizaLogger.info(`Using text after title as description`);
            } else {
              description = `Some thoughts about ${randomTopic} from ${this.runtime.character.name}.`;
              elizaLogger.info(`Using fallback description`);
            }
          }
        }
      }

      elizaLogger.info(`Generated forum post title: "${title}"`);
      elizaLogger.info(`Generated forum post description excerpt: "${description.substring(0, 50)}..."`);

      // Ensure minimum length for both fields
      if (title.length < 3) {
        title = `${this.runtime.character.name}'s Post`;
      }
      
      if (description.length < 10) {
        description = `This is a post by ${this.runtime.character.name}. More content will be added soon.`;
      }

      // Create memory for the post
      const postMemory = {
        id: stringToUuid(`forum-post-${Date.now()}`),
        userId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        roomId: this.defaultRoomId,
        content: {
          text: `${title}\n\n${description}`,
          action: "FORUM_CREATE_POST",
          options: {
            title,
            description
          }
        },
        createdAt: Date.now()
      };

      // Save the memory
      await this.runtime.messageManager.createMemory(postMemory);

      // Try to refresh tokens
      if (typeof this.forumService.refreshTokenIfNeeded === 'function') {
        await this.forumService.refreshTokenIfNeeded();
      }

      // Create the post
      const response = await this.forumService.createPost(title, description);

      elizaLogger.success(`Successfully created forum post: ${response.data ? response.data._id : 'ID not available'}`);

      // Update tokens in environment if they were refreshed
      const config = await validateForumConfig(this.runtime);
      const updatedTokens = this.forumService.getTokens();
      if (updatedTokens && updatedTokens.accessToken !== config.FORUM_ACCESS_TOKEN) {
        // Tokens were refreshed, update the env variables and save to file
        process.env.FORUM_ACCESS_TOKEN = updatedTokens.accessToken;
        if (updatedTokens.refreshToken) {
          process.env.FORUM_REFRESH_TOKEN = updatedTokens.refreshToken;
        }
        saveTokensToFile(updatedTokens);
      }

      return true;
    } catch (error) {
      elizaLogger.error("Error creating forum post:", error);
      return false;
    } finally {
      this.isPosting = false;
    }
  }
}
