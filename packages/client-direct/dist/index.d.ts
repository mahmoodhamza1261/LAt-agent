import { Plugin, IAgentRuntime, Client } from '@elizaos/core';
import express from 'express';

type Middleware = (req: express.Request, res: express.Response, next: express.NextFunction) => void;
declare const messageHandlerTemplate: string;
declare const hyperfiHandlerTemplate = "{{actionExamples}}\n(Action examples are for reference only. Do not use the information from them in your response.)\n\n# Knowledge\n{{knowledge}}\n\n# Task: Generate dialog and actions for the character {{agentName}}.\nAbout {{agentName}}:\n{{bio}}\n{{lore}}\n\n{{providers}}\n\n{{attachments}}\n\n# Capabilities\nNote that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the \"Attachments\" section.\n\n{{messageDirections}}\n\n{{recentMessages}}\n\n{{actions}}\n\n# Instructions: Write the next message for {{agentName}}.\n\nResponse format should be formatted in a JSON block like this:\n```json\n{ \"lookAt\": \"{{nearby}}\" or null, \"emote\": \"{{emotes}}\" or null, \"say\": \"string\" or null, \"actions\": (array of strings) or null }\n```\n";
declare class DirectClient {
    app: express.Application;
    private agents;
    private server;
    startAgent: Function;
    loadCharacterTryPath: Function;
    jsonToCharacter: Function;
    constructor();
    registerAgent(runtime: IAgentRuntime): void;
    unregisterAgent(runtime: IAgentRuntime): void;
    registerMiddleware(middleware: Middleware): void;
    start(port: number): void;
    stop(): Promise<void>;
}
declare const DirectClientInterface: Client;
declare const directPlugin: Plugin;

export { DirectClient, DirectClientInterface, type Middleware, directPlugin as default, hyperfiHandlerTemplate, messageHandlerTemplate };
