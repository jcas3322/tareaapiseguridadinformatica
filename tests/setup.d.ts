/**
 * Jest Test Setup
 * Global test configuration and utilities
 */
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidUUID(): R;
            toBeValidEmail(): R;
            toBeValidJWT(): R;
        }
    }
}
export {};
//# sourceMappingURL=setup.d.ts.map