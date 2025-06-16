import {
    elizaLogger,
    Action,
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    ModelClass,
    generateText,
    composeContext
} from "@elizaos/core";
import { validateForumConfig } from "../environment";
import { createForumPostExamples } from "../examples";
import { createForumService } from "../services";
import { saveTokensToFile } from "../setupEnvironment";

interface CreatePostOptions {
    title: string;
    description: string;
    topic?: string;
}

// Forum post generation template for auto-generating content
const forumPostGenerationTemplate = `
# You are {{agentName}}
{{bio}}
{{style}}

# User message:
{{userMessage}}

# Task:
Generate a forum post based on the user's message. The post should have a title and description.
Output must be in JSON format with the following structure:
{
  "title": "A catchy, relevant title (30-70 chars)",
  "description": "A thoughtful, engaging post description (200-500 chars)"
}

The post should match my personality and writing style as {{agentName}}.
`;

// Helper function to sanitize text by removing underscores and hyphens
function sanitizeText(text: string): string {
    if (!text) return text;
    // Replace underscores and hyphens with spaces
    return text.replace(/[_\-]/g, ' ').trim();
}

export const createForumPostAction: Action = {
    name: "FORUM_CREATE_POST",
    similes: [
        "POST_ON_FORUM",
        "CREATE_FORUM_POST",
        "PUBLISH_TO_FORUM"
    ],
    description: "Creates a post on the forum with the specified title and description.",
    validate: async (runtime: IAgentRuntime) => {
        try {
            await validateForumConfig(runtime);
            return true;
        } catch (error) {
            elizaLogger.error("Forum plugin validation failed:", error);
            return false;
        }
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: CreatePostOptions | any,
        callback: HandlerCallback
    ) => {
        try {
            // First check the message content for action data (highest priority source)
            let title = '';
            let description = '';
            let extractionSource = '';
            
            // 1. Direct extraction from message.content.options (from agent's content)
            if (message?.content?.action === 'FORUM_CREATE_POST' && message?.content?.options) {
                elizaLogger.info(`Found forum post data in message.content.options`);
                title = message.content.options.title || '';
                description = message.content.options.description || '';
                extractionSource = 'message.content.options';
                elizaLogger.info(`Extracted from message action - title: "${title}"`);
                elizaLogger.info(`Extracted from message action - description length: ${description?.length || 0}`);
            }

            // 2. Then check the passed options object
            if ((!title || !description) && options) {
                if (!title && options.title) {
                    title = options.title;
                    extractionSource = 'options';
                    elizaLogger.info(`Using title from options: "${title}"`);
                }
                if (!description && options.description) {
                    description = options.description;
                    extractionSource = 'options';
                    elizaLogger.info(`Using description from options, length: ${description?.length || 0}`);
                }
            }
            
            // 3. Extract from the original message text (the chatbot's actual conversational response)
            if (message?.content?.text) {
                elizaLogger.info(`Attempting to extract data from agent message text`);
                const text = message.content.text;
                
                // Try dash-separated format first: text—title: 'X', description: 'Y'
                const dashTitleDescMatch = text.match(/.*?[—\-–]\s*title\s*:\s*['"](.+?)['"][\s,]*description\s*:\s*['"](.+?)['"]/i);
                if (dashTitleDescMatch && dashTitleDescMatch[1] && dashTitleDescMatch[2]) {
                    title = dashTitleDescMatch[1].trim();
                    description = dashTitleDescMatch[2].trim();
                    extractionSource = 'message.content.text dash format';
                    elizaLogger.info(`Extracted from dash format - title: "${title}"`);
                    elizaLogger.info(`Extracted from dash format - description: "${description.substring(0, 30)}..."`);
                } else {
                    // Try standard format: title: 'X', description: 'Y'
                    const standardMatch = text.match(/title\s*:\s*['"](.+?)['"][\s,]*description\s*:\s*['"](.+?)['"]/i);
                    if (standardMatch && standardMatch[1] && standardMatch[2]) {
                        title = standardMatch[1].trim();
                        description = standardMatch[2].trim();
                        extractionSource = 'message.content.text standard format';
                        elizaLogger.info(`Extracted from standard format - title: "${title}"`);
                        elizaLogger.info(`Extracted from standard format - description: "${description.substring(0, 30)}..."`);
                    } else {
                        // Individual matches as fallback
                        if (!title) {
                            const titleMatch = text.match(/title[:\s]+['"](.+?)['"]/i) ||
                                              text.match(/title[:\s]+([^,'\"\n]+)/i);
                            if (titleMatch && titleMatch[1]) {
                                title = titleMatch[1].trim();
                                extractionSource = 'message.content.text title match';
                                elizaLogger.info(`Extracted title from message text: "${title}"`);
                            }
                        }
                        
                        if (!description) {
                            const descMatch = text.match(/description[:\s]+['"](.+?)['"]/i) ||
                                            text.match(/description[:\s]+([^,'\"\n]+)/i);
                            if (descMatch && descMatch[1]) {
                                description = descMatch[1].trim();
                                extractionSource = 'message.content.text desc match';
                                elizaLogger.info(`Extracted description from message text, length: ${description.length}`);
                            }
                        }
                    }
                }
                
                // Clean up extracted content
                if (title) {
                    // Remove any quotes around the title
                    title = title.replace(/^['"](.+)['"]$/, '$1').replace(/[,.;:'"!?]$/, '').trim();
                }
                
                if (description) {
                    // Remove any quotes around the description
                    description = description.replace(/^['"](.+)['"]$/, '$1').replace(/[,.;:'"!?]$/, '').trim();
                }
            }
            
            // Only auto-generate as a last resort if we couldn't extract from the agent's message
            if ((!title || !description) && (!extractionSource || extractionSource !== 'message.content.text')) {
                elizaLogger.info("Title or description missing. Will auto-generate content only as last resort.");
                
                try {
                    // Build context for text generation
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
${!title ? 'Create a brief, engaging title for this forum post.' : 'Use the existing title: "{{existingTitle}}"'}
${!description ? 'Create a thoughtful, informative forum post description (2-3 paragraphs).' : 'Use the existing description.'}

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

                    // Generate the content using the correct function
                    const generatedContent = await generateText({
                        runtime: runtime,
                        context: context,
                        modelClass: ModelClass.SMALL
                    });
                    
                    elizaLogger.info(`Generated content: ${generatedContent.substring(0, 100)}...`);
                    
                    // Try to parse the generated content as JSON
                    try {
                        const parsedContent = JSON.parse(generatedContent.trim());
                        if (!title && parsedContent.title) {
                            title = parsedContent.title.trim();
                            elizaLogger.info(`Using generated title: "${title}"`);
                        }
                        if (!description && parsedContent.description) {
                            description = parsedContent.description.trim();
                            elizaLogger.info(`Using generated description: "${description.substring(0, 50)}..."`);
                        }
                    } catch (parseError) {
                        elizaLogger.error(`Could not parse generated content as JSON: ${parseError.message}`);
                        // Try to extract title and description using regex as fallback
                        const titleMatch = generatedContent.match(/title[":]*\s*["']?([^"'\n]+)["']?/i);
                        const descMatch = generatedContent.match(/description[":]*\s*["']?([^"'\n]{20,})["']?/i);
                        
                        if (!title && titleMatch && titleMatch[1]) {
                            title = titleMatch[1].trim();
                            elizaLogger.info(`Extracted title from generated content: "${title}"`);
                        }
                        if (!description && descMatch && descMatch[1]) {
                            description = descMatch[1].trim();
                            elizaLogger.info(`Extracted description from generated content`);
                        }
                    }
                } catch (genError) {
                    elizaLogger.error(`Error generating forum content: ${genError.message}`);
                }
                
                // Final fallback values if generation failed
                if (!title) {
                    title = "Forum Post";
                    elizaLogger.info(`Using fallback title: "${title}"`);
                }
                
                if (!description) {
                    description = "This is a forum post.";
                    elizaLogger.info(`Using fallback description: "${description}"`);
                }
            }
            
            // Debug log finalized data
            elizaLogger.info(`FINAL VALUES BEING POSTED TO FORUM (source: ${extractionSource}):`);
            elizaLogger.info(`- Title: "${title}"`);
            elizaLogger.info(`- Description excerpt: "${description.substring(0, 30)}..."`);
            
            // Validate the title and description more thoroughly
            if (!title || typeof title !== 'string' || !title.trim()) {
                elizaLogger.error("Forum post title is invalid or empty");
                callback({
                    text: "Error creating forum post: Valid title is required. Please specify a title for your forum post.",
                });
                return false;
            }
            
            if (!description || typeof description !== 'string' || !description.trim()) {
                elizaLogger.error("Forum post description is invalid or empty");
                callback({
                    text: "Error creating forum post: Valid description is required. Please provide content for your forum post.",
                });
                return false;
            }
            
            // Get the forum config
            const config = await validateForumConfig(runtime);
            
            // Create the forum service
            const forumService = createForumService(
                config.FORUM_API_BASE_URL,
                config.FORUM_ACCESS_TOKEN,
                config.FORUM_REFRESH_TOKEN
            );
            
            // Try to refresh tokens, but handle the case if method doesn't exist
            try {
                elizaLogger.info("Checking forum access token...");
                if (typeof forumService.refreshTokenIfNeeded === 'function') {
                    await forumService.refreshTokenIfNeeded();
                    elizaLogger.info("Forum tokens refreshed successfully");
                } else {
                    elizaLogger.info("Token refresh method not available, continuing with current token");
                }
            } catch (tokenError) {
                elizaLogger.warn("Token refresh check failed, continuing with current token:", tokenError);
                // Continue with current token
            }
            
            // Create the post with sanitized inputs
            const response = await forumService.createPost(title.trim(), description.trim());
            
            elizaLogger.success(`Successfully created forum post: ${response.data._id}`);
            
            // Update tokens in environment if they were refreshed
            const updatedTokens = forumService.getTokens();
            if (updatedTokens.accessToken !== config.FORUM_ACCESS_TOKEN) {
                // Tokens were refreshed, update the env variables
                process.env.FORUM_ACCESS_TOKEN = updatedTokens.accessToken;
                process.env.FORUM_REFRESH_TOKEN = updatedTokens.refreshToken;
                
                // Save updated tokens to file
                saveTokensToFile(updatedTokens);
            }
            
            // Return success via callback - IMPORTANT: Use the exact title and description that was posted
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
        } catch (error: any) {
            elizaLogger.error("Error in Forum plugin handler:", error);
            callback({
                text: `Error creating forum post: ${error.message}`,
                content: { error: error.message },
            });
            return false;
        }
    },
    examples: createForumPostExamples as ActionExample[][],
} as Action;
