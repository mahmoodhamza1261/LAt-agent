import axios, { AxiosInstance } from 'axios';
import { elizaLogger } from "@elizaos/core";
import { saveTokensToFile } from './setupEnvironment';

interface TokenData {
    accessToken: string;
    refreshToken: string;
}

interface ForumServiceResponse {
    data: {
        _id: string;
        title: string;
        description: string;
        userName: string;
        createdAt: string;
    };
}

export class ForumService {
    private api: AxiosInstance;
    private baseURL: string;
    private accessToken: string;
    private refreshToken: string;

    constructor(baseURL: string, accessToken: string, refreshToken: string) {
        this.baseURL = baseURL;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;

        this.api = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
            }
        });

        // Add interceptor to handle token refresh
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
                        elizaLogger.error('Error refreshing tokens:', refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    private async refreshTokens(): Promise<boolean> {
        try {
            elizaLogger.info('Refreshing forum access token...');
            const response = await axios.post(`${this.baseURL}/auth/refresh-token`, {
                refreshToken: this.refreshToken
            });
            
            if (response.data && response.data.success) {
                const { accessToken, refreshToken } = response.data.data;
                this.accessToken = accessToken;
                this.refreshToken = refreshToken;
                
                // Save the updated tokens to file
                saveTokensToFile({
                    accessToken: this.accessToken,
                    refreshToken: this.refreshToken
                });
                
                elizaLogger.info('Forum tokens refreshed successfully');
                return true;
            }
            return false;
        } catch (error) {
            elizaLogger.error('Error refreshing forum tokens:', error);
            return false;
        }
    }

    public getTokens(): TokenData {
        return {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken
        };
    }
    
    public async refreshTokenIfNeeded(): Promise<boolean> {
        try {
            elizaLogger.info('Checking if token refresh is needed...');
            // Try a lightweight request to check token validity
            
            // Fix the API path issue - use v1/auth/verify-token instead of auth/verify-token
            const path = this.baseURL.includes('/v1') ? '/v1/auth/verify-token' : '/auth/verify-token';
            
            try {
                const response = await this.api.get(path, {
                    headers: { Authorization: `Bearer ${this.accessToken}` }
                });
                
                // If we reach here, token is valid
                elizaLogger.debug('Token is valid');
                return true;
                
            } catch (error) {
                if (error.response?.status === 401) {
                    // Token is invalid, refresh it
                    elizaLogger.info('Token appears to be invalid, refreshing...');
                    return await this.refreshTokens();
                }
                
                // For other status codes like 404, we still attempt to refresh the token
                if (error.response?.status === 404) {
                    elizaLogger.warn('Verify token endpoint not found, attempting to refresh token directly');
                    return await this.refreshTokens();
                }
                
                throw error;
            }
            
        } catch (error) {
            elizaLogger.warn('Could not verify/refresh token:', error);
            // Try direct refresh as fallback
            return await this.refreshTokens();
        }
    }

    public async createPost(title: string, description: string): Promise<ForumServiceResponse> {
        try {
            // Before creating a post, ensure the token is refreshed
            await this.refreshTokens();
            
            const endpoint = this.baseURL.includes('/v1') ? 
                '/v1/community/create-post' : '/community/create-post';
                
            const response = await this.api.post(endpoint, 
                { title, description },
                { headers: { Authorization: `Bearer ${this.accessToken}` } }
            );
            
            elizaLogger.info('Forum post created successfully');
            return response.data;
        } catch (error) {
            elizaLogger.error('Error creating forum post:', error);
            throw error;
        }
    }
}

export function createForumService(baseURL: string, accessToken: string, refreshToken: string): ForumService {
    return new ForumService(baseURL, accessToken, refreshToken);
}
