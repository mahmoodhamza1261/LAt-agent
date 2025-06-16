import { Action, IAgentRuntime, Memory, HandlerCallback, State, elizaLogger } from '@elizaos/core';

// Helper function to sanitize text by removing underscores and hyphens
function sanitizeText(text: string): string {
    if (!text) return text;
    // Replace underscores and hyphens with spaces
    return text.replace(/[_\-]/g, ' ').trim();
}

export const forumPostAction: Action = {
  name: 'FORUM_CREATE_POST',
  similes: ['post on forum', 'create forum post', 'publish to forum', 'share on forum'],
  description: 'Creates a post on the forum',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // The validation should only check if the runtime is available
    // Options validation will happen in the handler
    return true;
  },
  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state: State, 
    options: { title?: string; description?: string; topic?: string; }, 
    callback: HandlerCallback
  ) => {
    try {
      elizaLogger.info(`ForumAgentAction handler started`);
      elizaLogger.info(`Message content: ${JSON.stringify(message.content)}`);
      
      // Extract title and description with priority:
      let title = options?.title;
      let description = options?.description;
      let topic = options?.topic || "";
      let extractionSource = '';
      
      // First check the message text for title and description directly
      // This is our highest priority source because it's what the chatbot told the user
      if (message?.content?.text) {
        const text = message.content.text;
        elizaLogger.info(`CHECKING AGENT RESPONSE FOR TITLE/DESCRIPTION: "${text.substring(0, 100)}..."`);
        
        // Look for em-dash format first: "dialing it in with something sharp—title: 'X', description: 'Y'"
        const dashFormatMatch = text.match(/.*?[—\-–]\s*title\s*:\s*['"](.+?)['"][\s,]*description\s*:\s*['"](.+?)['"]/i);
        if (dashFormatMatch && dashFormatMatch[1] && dashFormatMatch[2]) {
          title = dashFormatMatch[1].trim();
          description = dashFormatMatch[2].trim();
          extractionSource = 'dash format';
          elizaLogger.info(`Extracted from dash format - title: "${title}"`);
          elizaLogger.info(`Extracted from dash format - description start: "${description.substring(0, 30)}..."`);
        } else {
          // Try standard format: "title: 'X', description: 'Y'"
          const standardFormatMatch = text.match(/title\s*:\s*['"](.+?)['"][\s,]*description\s*:\s*['"](.+?)['"]/i);
          if (standardFormatMatch && standardFormatMatch[1] && standardFormatMatch[2]) {
            title = standardFormatMatch[1].trim();
            description = standardFormatMatch[2].trim();
            extractionSource = 'standard format';
            elizaLogger.info(`Extracted from standard format - title: "${title}"`);
            elizaLogger.info(`Extracted from standard format - description start: "${description.substring(0, 30)}..."`);
          } else {
            // Try individual matches if combined pattern fails
            const titleMatch = text.match(/title\s*:\s*['"](.+?)['"]/i) || 
                            text.match(/title\s*:\s*([^,'\"\n]+)/i);
            const descMatch = text.match(/description\s*:\s*['"](.+?)['"]/i) || 
                             text.match(/description\s*:\s*([^,'\"\n]+)/i);
            
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim();
              extractionSource = 'title match';
              elizaLogger.info(`Extracted title from individual match: "${title}"`);
            }
            
            if (descMatch && descMatch[1]) {
              description = descMatch[1].trim();
              extractionSource = 'description match';
              elizaLogger.info(`Extracted description from individual match`);
            }
          }
        }
        
        // Clean up extracted content
        if (title) {
          title = title.replace(/^['"](.+)['"]$/, '$1').replace(/[,.;:'"!?]$/, '').trim();
        }
        
        if (description) {
          description = description.replace(/^['"](.+)['"]$/, '$1').replace(/[,.;:'"!?]$/, '').trim();
        }
      }
      
      // If we couldn't extract from message text, check for action data
      if ((!title || !description) && message?.content?.action === 'FORUM_CREATE_POST' && message?.content?.options) {
        if (!title && message.content.options.title) {
          title = message.content.options.title;
          extractionSource = 'action options';
          elizaLogger.info(`Found title in message.content.options: "${title}"`);
        }
        if (!description && message.content.options.description) {
          description = message.content.options.description;
          extractionSource = 'action options';
          elizaLogger.info(`Found description in message.content.options`);
        }
      }
      
      // Sanitize the text to remove underscores and hyphens
      if (title) {
        const originalTitle = title;
        title = sanitizeText(title);
        if (originalTitle !== title) {
          elizaLogger.info(`Sanitized title from "${originalTitle}" to "${title}"`);
        }
      }
      
      if (description) {
        const originalDescription = description;
        description = sanitizeText(description);
        if (originalDescription !== description) {
          elizaLogger.info(`Sanitized description (removed underscores and hyphens)`);
        }
      }
      
      // Log what we found
      elizaLogger.info(`EXTRACTED FORUM DATA (source: ${extractionSource}):`);
      elizaLogger.info(`- Title: "${title || 'NOT FOUND'}"`);
      elizaLogger.info(`- Description: ${description ? 
        `"${description.substring(0, 50)}${description.length > 50 ? '...' : ''}" (${description.length} chars)` : 
        'NOT FOUND'}`);
      
      // Find and use the forum plugin
      const forumPlugin = runtime.getPlugin('forum');
      if (!forumPlugin) {
        elizaLogger.error("Forum plugin not found in runtime");
        throw new Error('Forum plugin not found');
      }
      
      // Find the create post action from the forum plugin
      const createPostAction = forumPlugin.actions.find(a => a.name === 'FORUM_CREATE_POST');
      if (!createPostAction) {
        elizaLogger.error("Forum create post action not found in forum plugin");
        throw new Error('Forum create post action not found');
      }
      
      // Create the forwarded message with preserved text AND extracted title/description
      // This is important - we both keep the original message text AND include the extracted data
      const forwardMessage = {
        ...message,
        content: {
          ...message.content,
          action: 'FORUM_CREATE_POST',
          options: {
            title,
            description,
            topic
          }
        }
      };
      
      // Call the action's handler with our prepared data
      const success = await createPostAction.handler(
        runtime,
        forwardMessage,
        state,
        { title, description, topic },
        callback
      );
      
      elizaLogger.info(`Forum plugin handler completed with success: ${success}`);
      return success;
    } catch (error: any) {
      elizaLogger.error(`Forum post creation error: ${error.message}`, error);
      callback({ 
        text: `Failed to create forum post: ${error.message}`,
        content: { error: error.message }
      });
      return false;
    }
  },
};
