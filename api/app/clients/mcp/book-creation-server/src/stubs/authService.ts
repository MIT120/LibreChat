/**
 * Stub implementation for AuthService functions
 * This is a temporary solution to avoid import issues with CommonJS modules
 */

export function generateShortLivedToken(userId: string, expireIn: string = '5m'): string {
    // Simple stub implementation - in production this would need proper JWT generation
    const mockToken = Buffer.from(JSON.stringify({
        userId,
        exp: Date.now() + (5 * 60 * 1000), // 5 minutes from now
        iat: Date.now()
    })).toString('base64');
    
    return `stub.${mockToken}.signature`;
}
