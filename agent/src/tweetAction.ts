// custom_actions/tweetAction.ts
import { Action, IAgentRuntime, Memory } from '@elizaos/core';

export const tweetAction: Action = {
  name: 'POST_TWEET',
  similes: ['tweet', 'post on Twitter'],
  description: 'Posts a tweet on Twitter',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Validate the message content or other conditions
    return message.content.text.length > 0;
  },
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const twitterClient = runtime.clients.twitter;
    const content = message.content.text;

    try {
      await twitterClient.createPost(content);
      return { success: true, message: 'Tweet posted successfully!' };
    } catch (error) {
      return { success: false, message: 'Failed to post tweet.' };
    }
  },
};
