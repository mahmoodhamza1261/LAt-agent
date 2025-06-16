export interface CreatePostResponse {
    success: boolean;
    message: string;
    data: {
        userId: string;
        title: string;
        description: string;
        likes: number;
        comments: number;
        followers: number;
        _id: string;
        createdAt: string;
        updatedAt: string;
        __v: number;
        userName: string;
        profilePic: string;
    };
}

export interface TokenData {
    accessToken: string;
    refreshToken: string;
}

export interface RefreshTokenResponse {
    success: boolean;
    data: TokenData;
}
