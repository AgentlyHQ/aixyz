import { track } from "@vercel/analytics/server";

/**
 * Track API endpoint usage with Vercel Analytics
 * This allows monitoring of API usage patterns in the Vercel dashboard
 */
export async function trackApiCall(endpoint: string, method: string, metadata?: Record<string, string | number>) {
  try {
    // Only track in production/Vercel environment
    if (process.env.VERCEL) {
      await track(endpoint, {
        method,
        ...metadata,
      });
    }
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.error("Analytics tracking error:", error);
  }
}

/**
 * Express middleware to track all requests
 */
export function analyticsMiddleware(req: any, res: any, next: any) {
  // Track the request asynchronously (don't block the response)
  const endpoint = req.path;
  const method = req.method;
  
  // Track on response finish
  res.on("finish", () => {
    trackApiCall(endpoint, method, {
      statusCode: res.statusCode,
    }).catch((err) => console.error("Failed to track API call:", err));
  });

  next();
}
