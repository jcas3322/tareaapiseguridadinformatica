/**
 * Custom Jest Matchers for Security Testing
 * Provides specialized matchers for security-related assertions
 */
declare global {
    namespace jest {
        interface Matchers<R> {
            toHaveSecurityHeaders(): R;
            toBeSecurePassword(): R;
            toBeValidJWT(): R;
            toNotExposeInternalInfo(): R;
            toHaveRateLimitHeaders(): R;
            toBeSecureFileUpload(): R;
            toPreventInjection(): R;
            toHaveCSPHeader(): R;
            toPreventXSS(): R;
            toHaveSecureSessionConfig(): R;
        }
    }
}
export {};
//# sourceMappingURL=security-matchers.d.ts.map