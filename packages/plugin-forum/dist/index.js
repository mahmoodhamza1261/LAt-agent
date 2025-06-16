// src/actions/createForumPost.ts
import {
  elizaLogger as elizaLogger3,
  ModelClass,
  generateText,
  composeContext
} from "@elizaos/core";

// src/environment.ts
import { z } from "zod";
var forumEnvSchema = z.object({
  FORUM_API_BASE_URL: z.string().min(1, "Forum API base URL is required"),
  FORUM_ACCESS_TOKEN: z.string().min(1, "Forum access token is required"),
  FORUM_REFRESH_TOKEN: z.string().min(1, "Forum refresh token is required"),
  ENABLE_FORUM_POST_GENERATION: z.string().optional().transform((val) => val === "true"),
  FORUM_POST_INTERVAL_MIN: z.string().optional().transform((val) => parseInt(val || "90", 10)),
  FORUM_POST_INTERVAL_MAX: z.string().optional().transform((val) => parseInt(val || "180", 10))
});
async function validateForumConfig(runtime) {
  try {
    const config = {
      FORUM_API_BASE_URL: process.env.FORUM_API_BASE_URL || runtime.getSetting("FORUM_API_BASE_URL"),
      FORUM_ACCESS_TOKEN: process.env.FORUM_ACCESS_TOKEN || runtime.getSetting("FORUM_ACCESS_TOKEN"),
      FORUM_REFRESH_TOKEN: process.env.FORUM_REFRESH_TOKEN || runtime.getSetting("FORUM_REFRESH_TOKEN"),
      ENABLE_FORUM_POST_GENERATION: process.env.ENABLE_FORUM_POST_GENERATION || runtime.getSetting("ENABLE_FORUM_POST_GENERATION") || "false",
      FORUM_POST_INTERVAL_MIN: process.env.FORUM_POST_INTERVAL_MIN || runtime.getSetting("FORUM_POST_INTERVAL_MIN") || "90",
      FORUM_POST_INTERVAL_MAX: process.env.FORUM_POST_INTERVAL_MAX || runtime.getSetting("FORUM_POST_INTERVAL_MAX") || "180"
    };
    return forumEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `Forum API configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/examples.ts
var createForumPostExamples = [
  [
    {
      user: "{{user1}}",
      content: {
        text: "Can you create a forum post about AI advancements with title 'Future of AI' and description explaining recent breakthroughs?"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "I'll create a forum post about AI advancements for you.",
        action: "FORUM_CREATE_POST",
        options: {
          title: "Future of AI",
          description: "Recent AI breakthroughs include multimodal models like GPT-4V, advances in reasoning capabilities, and more efficient training methods."
        }
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "Make a forum post with title 'Interesting Tech News' and description about the latest tech developments"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "I'll create that forum post for you right now.",
        action: "FORUM_CREATE_POST",
        options: {
          title: "Interesting Tech News",
          description: "The latest tech developments include advancements in quantum computing, new augmented reality devices, and breakthroughs in renewable energy storage."
        }
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "Share your thoughts on future technology on the forum"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "I'll share my thoughts on future technology in a forum post.",
        action: "FORUM_CREATE_POST",
        options: {
          title: "Perspectives on Future Technology",
          description: "I believe future technology will increasingly blur the lines between digital and physical realities, with AI integration becoming seamless in our daily lives."
        }
      }
    }
  ]
];

// src/services.ts
import axios from "axios";
import { elizaLogger as elizaLogger2 } from "@elizaos/core";

// src/setupEnvironment.ts
import fs from "fs";
import path from "path";
import { elizaLogger } from "@elizaos/core";
var DEFAULT_TOKENS_PATH = path.join(process.cwd(), "forum-tokens.json");
var TOKENS_FILE_PATH = process.env.FORUM_TOKENS_FILE || DEFAULT_TOKENS_PATH;
function loadTokensFromFile() {
  try {
    if (fs.existsSync(TOKENS_FILE_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE_PATH, "utf8"));
      if (tokens.accessToken && tokens.refreshToken) {
        elizaLogger.log("Forum tokens loaded from file");
        return tokens;
      }
    }
    return null;
  } catch (error) {
    elizaLogger.error("Error loading tokens from file:", error);
    return null;
  }
}
function saveTokensToFile(tokens) {
  try {
    fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(tokens, null, 2));
    elizaLogger.log("Forum tokens saved to file");
    return true;
  } catch (error) {
    elizaLogger.error("Error saving tokens to file:", error);
    return false;
  }
}
function initializeForumEnvironment() {
  if (!process.env.FORUM_ACCESS_TOKEN || !process.env.FORUM_REFRESH_TOKEN) {
    const tokens = loadTokensFromFile();
    if (tokens) {
      process.env.FORUM_ACCESS_TOKEN = tokens.accessToken;
      process.env.FORUM_REFRESH_TOKEN = tokens.refreshToken;
      elizaLogger.log("Forum environment initialized from file");
    }
  }
  if (!process.env.FORUM_API_BASE_URL) {
    process.env.FORUM_API_BASE_URL = "https://otlaw-api-gateway.dev.mwancloud.com/api";
    elizaLogger.log("Using default Forum API base URL");
  }
  if (!fs.existsSync(TOKENS_FILE_PATH) && process.env.FORUM_ACCESS_TOKEN && process.env.FORUM_REFRESH_TOKEN) {
    saveTokensToFile({
      accessToken: process.env.FORUM_ACCESS_TOKEN,
      refreshToken: process.env.FORUM_REFRESH_TOKEN
    });
    elizaLogger.log("Initial forum tokens file created");
  }
  if (process.env.FORUM_ACCESS_TOKEN && process.env.FORUM_REFRESH_TOKEN) {
    elizaLogger.log("Forum environment is initialized");
  } else {
    elizaLogger.warn("Forum environment is not fully initialized. Tokens are missing.");
  }
}

// src/services.ts
var ForumService = class {
  api;
  baseURL;
  accessToken;
  refreshToken;
  constructor(baseURL, accessToken, refreshToken) {
    this.baseURL = baseURL;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.api = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json"
      }
    });
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && error.config && !error.config.__isRetry) {
          try {
            const refreshed = await this.refreshTokens();
            if (refreshed) {
              error.config.__isRetry = true;
              error.config.headers.Authorization = `Bearer ${this.accessToken}`;
              return this.api(error.config);
            }
          } catch (refreshError) {
            elizaLogger2.error("Error refreshing tokens:", refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }
  async refreshTokens() {
    try {
      elizaLogger2.info("Refreshing forum access token...");
      const response = await axios.post(`${this.baseURL}/auth/refresh-token`, {
        refreshToken: this.refreshToken
      });
      if (response.data && response.data.success) {
        const { accessToken, refreshToken } = response.data.data;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        saveTokensToFile({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken
        });
        elizaLogger2.info("Forum tokens refreshed successfully");
        return true;
      }
      return false;
    } catch (error) {
      elizaLogger2.error("Error refreshing forum tokens:", error);
      return false;
    }
  }
  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken
    };
  }
  async refreshTokenIfNeeded() {
    try {
      elizaLogger2.info("Checking if token refresh is needed...");
      const path2 = this.baseURL.includes("/v1") ? "/v1/auth/verify-token" : "/auth/verify-token";
      try {
        const response = await this.api.get(path2, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        elizaLogger2.debug("Token is valid");
        return true;
      } catch (error) {
        if (error.response?.status === 401) {
          elizaLogger2.info("Token appears to be invalid, refreshing...");
          return await this.refreshTokens();
        }
        if (error.response?.status === 404) {
          elizaLogger2.warn("Verify token endpoint not found, attempting to refresh token directly");
          return await this.refreshTokens();
        }
        throw error;
      }
    } catch (error) {
      elizaLogger2.warn("Could not verify/refresh token:", error);
      return await this.refreshTokens();
    }
  }
  async createPost(title, description) {
    try {
      await this.refreshTokens();
      const endpoint = this.baseURL.includes("/v1") ? "/v1/community/create-post" : "/community/create-post";
      const response = await this.api.post(
        endpoint,
        { title, description },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      elizaLogger2.info("Forum post created successfully");
      return response.data;
    } catch (error) {
      elizaLogger2.error("Error creating forum post:", error);
      throw error;
    }
  }
};
function createForumService(baseURL, accessToken, refreshToken) {
  return new ForumService(baseURL, accessToken, refreshToken);
}

// src/actions/createForumPost.ts
var createForumPostAction = {
  name: "FORUM_CREATE_POST",
  similes: [
    "POST_ON_FORUM",
    "CREATE_FORUM_POST",
    "PUBLISH_TO_FORUM"
  ],
  description: "Creates a post on the forum with the specified title and description.",
  validate: async (runtime) => {
    try {
      await validateForumConfig(runtime);
      return true;
    } catch (error) {
      elizaLogger3.error("Forum plugin validation failed:", error);
      return false;
    }
  },
  handler: async (runtime, message, state, options, callback) => {
    try {
      let title = "";
      let description = "";
      let extractionSource = "";
      if (message?.content?.action === "FORUM_CREATE_POST" && message?.content?.options) {
        elizaLogger3.info(`Found forum post data in message.content.options`);
        title = message.content.options.title || "";
        description = message.content.options.description || "";
        extractionSource = "message.content.options";
        elizaLogger3.info(`Extracted from message action - title: "${title}"`);
        elizaLogger3.info(`Extracted from message action - description length: ${description?.length || 0}`);
      }
      if ((!title || !description) && options) {
        if (!title && options.title) {
          title = options.title;
          extractionSource = "options";
          elizaLogger3.info(`Using title from options: "${title}"`);
        }
        if (!description && options.description) {
          description = options.description;
          extractionSource = "options";
          elizaLogger3.info(`Using description from options, length: ${description?.length || 0}`);
        }
      }
      if (message?.content?.text) {
        elizaLogger3.info(`Attempting to extract data from agent message text`);
        const text = message.content.text;
        const dashTitleDescMatch = text.match(/.*?[—\-–]\s*title\s*:\s*['"](.+?)['"][\s,]*description\s*:\s*['"](.+?)['"]/i);
        if (dashTitleDescMatch && dashTitleDescMatch[1] && dashTitleDescMatch[2]) {
          title = dashTitleDescMatch[1].trim();
          description = dashTitleDescMatch[2].trim();
          extractionSource = "message.content.text dash format";
          elizaLogger3.info(`Extracted from dash format - title: "${title}"`);
          elizaLogger3.info(`Extracted from dash format - description: "${description.substring(0, 30)}..."`);
        } else {
          const standardMatch = text.match(/title\s*:\s*['"](.+?)['"][\s,]*description\s*:\s*['"](.+?)['"]/i);
          if (standardMatch && standardMatch[1] && standardMatch[2]) {
            title = standardMatch[1].trim();
            description = standardMatch[2].trim();
            extractionSource = "message.content.text standard format";
            elizaLogger3.info(`Extracted from standard format - title: "${title}"`);
            elizaLogger3.info(`Extracted from standard format - description: "${description.substring(0, 30)}..."`);
          } else {
            if (!title) {
              const titleMatch = text.match(/title[:\s]+['"](.+?)['"]/i) || text.match(/title[:\s]+([^,'\"\n]+)/i);
              if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim();
                extractionSource = "message.content.text title match";
                elizaLogger3.info(`Extracted title from message text: "${title}"`);
              }
            }
            if (!description) {
              const descMatch = text.match(/description[:\s]+['"](.+?)['"]/i) || text.match(/description[:\s]+([^,'\"\n]+)/i);
              if (descMatch && descMatch[1]) {
                description = descMatch[1].trim();
                extractionSource = "message.content.text desc match";
                elizaLogger3.info(`Extracted description from message text, length: ${description.length}`);
              }
            }
          }
        }
        if (title) {
          title = title.replace(/^['"](.+)['"]$/, "$1").replace(/[,.;:'"!?]$/, "").trim();
        }
        if (description) {
          description = description.replace(/^['"](.+)['"]$/, "$1").replace(/[,.;:'"!?]$/, "").trim();
        }
      }
      if ((!title || !description) && (!extractionSource || extractionSource !== "message.content.text")) {
        elizaLogger3.info("Title or description missing. Will auto-generate content only as last resort.");
        try {
          const context = composeContext({
            state: {
              messageText: message?.content?.text || "Create a forum post",
              userRequest: message?.content?.text || "Create a forum post",
              missingTitle: !title,
              missingDescription: !description,
              existingTitle: title,
              existingDescription: description
            },
            template: `
# INSTRUCTIONS
You're helping to create a forum post based on a user request: "{{userRequest}}"
${!title ? "Create a brief, engaging title for this forum post." : 'Use the existing title: "{{existingTitle}}"'}
${!description ? "Create a thoughtful, informative forum post description (2-3 paragraphs)." : "Use the existing description."}

# OUTPUT FORMAT
Respond with JSON in this format:
{
  "title": "The generated forum post title",
  "description": "The generated forum post description"
}

# CONSTRAINTS
- Keep titles concise (under 100 characters)
- Make descriptions thoughtful but concise
- Stay on topic related to the user request
- Never include quotation marks around the entire response
- Never include markdown formatting
`
          });
          const generatedContent = await generateText({
            runtime,
            context,
            modelClass: ModelClass.SMALL
          });
          elizaLogger3.info(`Generated content: ${generatedContent.substring(0, 100)}...`);
          try {
            const parsedContent = JSON.parse(generatedContent.trim());
            if (!title && parsedContent.title) {
              title = parsedContent.title.trim();
              elizaLogger3.info(`Using generated title: "${title}"`);
            }
            if (!description && parsedContent.description) {
              description = parsedContent.description.trim();
              elizaLogger3.info(`Using generated description: "${description.substring(0, 50)}..."`);
            }
          } catch (parseError) {
            elizaLogger3.error(`Could not parse generated content as JSON: ${parseError.message}`);
            const titleMatch = generatedContent.match(/title[":]*\s*["']?([^"'\n]+)["']?/i);
            const descMatch = generatedContent.match(/description[":]*\s*["']?([^"'\n]{20,})["']?/i);
            if (!title && titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim();
              elizaLogger3.info(`Extracted title from generated content: "${title}"`);
            }
            if (!description && descMatch && descMatch[1]) {
              description = descMatch[1].trim();
              elizaLogger3.info(`Extracted description from generated content`);
            }
          }
        } catch (genError) {
          elizaLogger3.error(`Error generating forum content: ${genError.message}`);
        }
        if (!title) {
          title = "Forum Post";
          elizaLogger3.info(`Using fallback title: "${title}"`);
        }
        if (!description) {
          description = "This is a forum post.";
          elizaLogger3.info(`Using fallback description: "${description}"`);
        }
      }
      elizaLogger3.info(`FINAL VALUES BEING POSTED TO FORUM (source: ${extractionSource}):`);
      elizaLogger3.info(`- Title: "${title}"`);
      elizaLogger3.info(`- Description excerpt: "${description.substring(0, 30)}..."`);
      if (!title || typeof title !== "string" || !title.trim()) {
        elizaLogger3.error("Forum post title is invalid or empty");
        callback({
          text: "Error creating forum post: Valid title is required. Please specify a title for your forum post."
        });
        return false;
      }
      if (!description || typeof description !== "string" || !description.trim()) {
        elizaLogger3.error("Forum post description is invalid or empty");
        callback({
          text: "Error creating forum post: Valid description is required. Please provide content for your forum post."
        });
        return false;
      }
      const config = await validateForumConfig(runtime);
      const forumService = createForumService(
        config.FORUM_API_BASE_URL,
        config.FORUM_ACCESS_TOKEN,
        config.FORUM_REFRESH_TOKEN
      );
      try {
        elizaLogger3.info("Checking forum access token...");
        if (typeof forumService.refreshTokenIfNeeded === "function") {
          await forumService.refreshTokenIfNeeded();
          elizaLogger3.info("Forum tokens refreshed successfully");
        } else {
          elizaLogger3.info("Token refresh method not available, continuing with current token");
        }
      } catch (tokenError) {
        elizaLogger3.warn("Token refresh check failed, continuing with current token:", tokenError);
      }
      const response = await forumService.createPost(title.trim(), description.trim());
      elizaLogger3.success(`Successfully created forum post: ${response.data._id}`);
      const updatedTokens = forumService.getTokens();
      if (updatedTokens.accessToken !== config.FORUM_ACCESS_TOKEN) {
        process.env.FORUM_ACCESS_TOKEN = updatedTokens.accessToken;
        process.env.FORUM_REFRESH_TOKEN = updatedTokens.refreshToken;
        saveTokensToFile(updatedTokens);
      }
      callback({
        text: `Forum post created successfully! Title: "${title}". You can view it on the forum.`,
        content: {
          postId: response.data._id,
          title: response.data.title,
          description: response.data.description,
          userName: response.data.userName,
          createdAt: response.data.createdAt
        }
      });
      return true;
    } catch (error) {
      elizaLogger3.error("Error in Forum plugin handler:", error);
      callback({
        text: `Error creating forum post: ${error.message}`,
        content: { error: error.message }
      });
      return false;
    }
  },
  examples: createForumPostExamples
};

// src/client.ts
import { elizaLogger as elizaLogger5 } from "@elizaos/core";

// src/post.ts
import { elizaLogger as elizaLogger4, generateText as generateText2, ModelClass as ModelClass2, composeContext as composeContext2, stringToUuid } from "@elizaos/core";
var forumPostGenerationTemplate = `
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
var ForumPostClient = class {
  runtime;
  isPosting = false;
  postInterval;
  postIntervalMin;
  postIntervalMax;
  enablePostGeneration;
  timer = null;
  forumService;
  defaultRoomId;
  constructor(runtime) {
    this.runtime = runtime;
    this.postIntervalMin = parseInt(this.runtime.getSetting("FORUM_POST_INTERVAL_MIN") || "90", 10) * 60 * 1e3;
    this.postIntervalMax = parseInt(this.runtime.getSetting("FORUM_POST_INTERVAL_MAX") || "180", 10) * 60 * 1e3;
    this.postInterval = this.getRandomInterval();
    this.enablePostGeneration = this.runtime.getSetting("ENABLE_FORUM_POST_GENERATION") === "true";
    this.defaultRoomId = stringToUuid(`forum-auto-${this.runtime.agentId}`);
    elizaLogger4.info(`Forum post client initialized with settings:
      - Enable post generation: ${this.enablePostGeneration}
      - Post interval min: ${this.postIntervalMin / (60 * 1e3)} minutes
      - Post interval max: ${this.postIntervalMax / (60 * 1e3)} minutes
      - Default room ID: ${this.defaultRoomId}
    `);
  }
  async init() {
    try {
      const config = await validateForumConfig(this.runtime);
      this.forumService = createForumService(
        config.FORUM_API_BASE_URL,
        config.FORUM_ACCESS_TOKEN,
        config.FORUM_REFRESH_TOKEN
      );
      await this.ensureDefaultRoom();
      if (this.enablePostGeneration) {
        elizaLogger4.info("Automatic forum post generation is enabled");
        this.scheduleNextPost();
      } else {
        elizaLogger4.info("Automatic forum post generation is disabled");
      }
    } catch (error) {
      elizaLogger4.error("Failed to initialize forum post client:", error);
    }
  }
  async ensureDefaultRoom() {
    try {
      const roomExists = await this.runtime.databaseAdapter?.getRoom(this.defaultRoomId);
      if (!roomExists) {
        elizaLogger4.info(`Creating default forum room with ID: ${this.defaultRoomId}`);
        await this.runtime.databaseAdapter?.createRoom(this.defaultRoomId);
        await this.runtime.databaseAdapter?.addParticipant(
          this.runtime.agentId,
          this.defaultRoomId
        );
      } else {
        elizaLogger4.debug(`Default forum room already exists: ${this.defaultRoomId}`);
      }
    } catch (error) {
      elizaLogger4.error("Error ensuring default room exists:", error);
      this.defaultRoomId = stringToUuid(`forum-fallback-${Date.now()}`);
      elizaLogger4.info(`Created fallback room ID: ${this.defaultRoomId}`);
    }
  }
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  getRandomInterval() {
    return Math.floor(Math.random() * (this.postIntervalMax - this.postIntervalMin + 1)) + this.postIntervalMin;
  }
  scheduleNextPost() {
    this.postInterval = this.getRandomInterval();
    elizaLogger4.info(`Scheduling next forum post in ${this.postInterval / (60 * 1e3)} minutes`);
    this.timer = setTimeout(() => {
      this.createPost().catch((err) => {
        elizaLogger4.error("Error creating forum post:", err);
      }).finally(() => {
        this.scheduleNextPost();
      });
    }, this.postInterval);
  }
  async createPost(title, description) {
    if (this.isPosting) {
      elizaLogger4.warn("Already creating a forum post, skipping");
      return false;
    }
    this.isPosting = true;
    try {
      if (!title || !description) {
        elizaLogger4.info("Generating forum post content...");
        const topics = this.runtime.character.topics || [
          "Technology",
          "Philosophy",
          "Science",
          "Art",
          "Culture",
          "Society",
          "Future"
        ];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
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
        const context = composeContext2({
          state,
          template: forumPostGenerationTemplate
        });
        const generatedContent = await generateText2({
          runtime: this.runtime,
          context,
          modelClass: ModelClass2.SMALL,
          stop: ["</response>", "---", "###"]
        });
        elizaLogger4.debug(`Generated raw content: ${generatedContent.substring(0, 100)}...`);
        const titleMatch = generatedContent.match(/Title:\s*["'](.+?)["']/);
        const descriptionMatch = generatedContent.match(/Description:\s*["']([\s\S]+?)["']/);
        if (!titleMatch && !descriptionMatch) {
          elizaLogger4.error("Failed to extract title or description from generated content");
          elizaLogger4.debug("Full generated content:", generatedContent);
          title = `${this.runtime.character.name}'s Thoughts on ${randomTopic}`;
          description = generatedContent.trim();
          elizaLogger4.info(`Using fallback title and raw content as description`);
        } else {
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
          } else {
            title = `${this.runtime.character.name}'s Thoughts on ${randomTopic}`;
            elizaLogger4.info(`Using fallback title: "${title}"`);
          }
          if (descriptionMatch && descriptionMatch[1]) {
            description = descriptionMatch[1].trim();
          } else {
            const afterTitle = generatedContent.split(/Title:\s*["'](.+?)["']/)[2];
            if (afterTitle) {
              description = afterTitle.replace(/^[\s\n:]*Description:\s*/i, "").trim();
              elizaLogger4.info(`Using text after title as description`);
            } else {
              description = `Some thoughts about ${randomTopic} from ${this.runtime.character.name}.`;
              elizaLogger4.info(`Using fallback description`);
            }
          }
        }
      }
      elizaLogger4.info(`Generated forum post title: "${title}"`);
      elizaLogger4.info(`Generated forum post description excerpt: "${description.substring(0, 50)}..."`);
      if (title.length < 3) {
        title = `${this.runtime.character.name}'s Post`;
      }
      if (description.length < 10) {
        description = `This is a post by ${this.runtime.character.name}. More content will be added soon.`;
      }
      const postMemory = {
        id: stringToUuid(`forum-post-${Date.now()}`),
        userId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        roomId: this.defaultRoomId,
        content: {
          text: `${title}

${description}`,
          action: "FORUM_CREATE_POST",
          options: {
            title,
            description
          }
        },
        createdAt: Date.now()
      };
      await this.runtime.messageManager.createMemory(postMemory);
      if (typeof this.forumService.refreshTokenIfNeeded === "function") {
        await this.forumService.refreshTokenIfNeeded();
      }
      const response = await this.forumService.createPost(title, description);
      elizaLogger4.success(`Successfully created forum post: ${response.data ? response.data._id : "ID not available"}`);
      const config = await validateForumConfig(this.runtime);
      const updatedTokens = this.forumService.getTokens();
      if (updatedTokens && updatedTokens.accessToken !== config.FORUM_ACCESS_TOKEN) {
        process.env.FORUM_ACCESS_TOKEN = updatedTokens.accessToken;
        if (updatedTokens.refreshToken) {
          process.env.FORUM_REFRESH_TOKEN = updatedTokens.refreshToken;
        }
        saveTokensToFile(updatedTokens);
      }
      return true;
    } catch (error) {
      elizaLogger4.error("Error creating forum post:", error);
      return false;
    } finally {
      this.isPosting = false;
    }
  }
};

// src/client.ts
var ForumClient = class {
  name = "forum";
  runtime;
  postClient = null;
  async start(runtime) {
    elizaLogger5.info("Starting forum client");
    this.runtime = runtime;
    try {
      await validateForumConfig(runtime);
      this.postClient = new ForumPostClient(runtime);
      await this.postClient.init();
      elizaLogger5.success("Forum client started successfully");
      return this;
    } catch (error) {
      elizaLogger5.error("Error starting forum client:", error);
      return this;
    }
  }
  async stop() {
    elizaLogger5.info("Stopping forum client");
    if (this.postClient) {
      this.postClient.stop();
    }
  }
  async createPost(title, description) {
    if (this.postClient) {
      return this.postClient.createPost(title, description);
    } else {
      elizaLogger5.error("Post client not initialized");
      return Promise.reject(new Error("Post client not initialized"));
    }
  }
};
var ForumClientInterface = {
  name: "forum",
  config: {},
  start: async (runtime) => {
    const client = new ForumClient();
    return client.start(runtime);
  }
};

// src/index.ts
initializeForumEnvironment();
var forumPlugin = {
  name: "forum",
  description: "Forum API plugin for Eliza",
  actions: [createForumPostAction],
  evaluators: [],
  providers: [],
  clients: [ForumClientInterface]
};
var index_default = forumPlugin;
export {
  index_default as default,
  forumPlugin
};
//# sourceMappingURL=index.js.map