import fs from 'fs';
import path from 'path';
import { elizaLogger } from "@elizaos/core";

interface TokenData {
    accessToken: string;
    refreshToken: string;
}

// Default location for tokens file, can be overridden by environment variable
const DEFAULT_TOKENS_PATH = path.join(process.cwd(), 'forum-tokens.json');
const TOKENS_FILE_PATH = process.env.FORUM_TOKENS_FILE || DEFAULT_TOKENS_PATH;

// Function to load tokens from file
export function loadTokensFromFile(): TokenData | null {
    try {
        if (fs.existsSync(TOKENS_FILE_PATH)) {
            const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE_PATH, 'utf8'));
            
            if (tokens.accessToken && tokens.refreshToken) {
                elizaLogger.log('Forum tokens loaded from file');
                return tokens as TokenData;
            }
        }
        return null;
    } catch (error) {
        elizaLogger.error('Error loading tokens from file:', error);
        return null;
    }
}

// Function to save tokens to file
export function saveTokensToFile(tokens: TokenData): boolean {
    try {
        fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(tokens, null, 2));
        elizaLogger.log('Forum tokens saved to file');
        return true;
    } catch (error) {
        elizaLogger.error('Error saving tokens to file:', error);
        return false;
    }
}

// Function to initialize environment with tokens
export function initializeForumEnvironment() {
    // Try to load tokens from file if not already set
    if (!process.env.FORUM_ACCESS_TOKEN || !process.env.FORUM_REFRESH_TOKEN) {
        const tokens = loadTokensFromFile();
        if (tokens) {
            process.env.FORUM_ACCESS_TOKEN = tokens.accessToken;
            process.env.FORUM_REFRESH_TOKEN = tokens.refreshToken;
            elizaLogger.log('Forum environment initialized from file');
        }
    }
    
    // Set default API base URL if not set
    if (!process.env.FORUM_API_BASE_URL) {
        process.env.FORUM_API_BASE_URL = 'https://otlaw-api-gateway.dev.mwancloud.com/api';
        elizaLogger.log('Using default Forum API base URL');
    }
    
    // Create initial tokens file if it doesn't exist and we have tokens in environment variables
    if (!fs.existsSync(TOKENS_FILE_PATH) && process.env.FORUM_ACCESS_TOKEN && process.env.FORUM_REFRESH_TOKEN) {
        saveTokensToFile({
            accessToken: process.env.FORUM_ACCESS_TOKEN,
            refreshToken: process.env.FORUM_REFRESH_TOKEN,
        });
        elizaLogger.log('Initial forum tokens file created');
    }
    
    // Log initialization status
    if (process.env.FORUM_ACCESS_TOKEN && process.env.FORUM_REFRESH_TOKEN) {
        elizaLogger.log('Forum environment is initialized');
    } else {
        elizaLogger.warn('Forum environment is not fully initialized. Tokens are missing.');
    }
}
