export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
/** Demo mode is never active in production, whatever DEMO_MODE says. */
export const demoMode = () => process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
