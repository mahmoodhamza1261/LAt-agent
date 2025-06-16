import { ActionExample } from "@elizaos/core";

export const createForumPostExamples: ActionExample[][] = [
    [
        {
            user: "{{user1}}",
            content: {
                text: "Can you create a forum post about AI advancements with title 'Future of AI' and description explaining recent breakthroughs?",
            },
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
            },
        }
    ],
    [
        {
            user: "{{user1}}",
            content: {
                text: "Make a forum post with title 'Interesting Tech News' and description about the latest tech developments",
            },
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
            },
        }
    ],
    [
        {
            user: "{{user1}}",
            content: {
                text: "Share your thoughts on future technology on the forum",
            },
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
            },
        }
    ]
];
