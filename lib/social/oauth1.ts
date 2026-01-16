import * as crypto from "crypto";

/**
 * OAuth 1.0a signing utility for Twitter API v1.1 endpoints
 * Required for media upload endpoints that don't support OAuth 2.0
 */

interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

/**
 * Generate OAuth 1.0a signature for a request
 */
export function generateOAuth1Signature(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: OAuth1Credentials
): string {
  const {
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
  } = credentials;

  // Step 1: Collect parameters
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };

  // Only include oauth_token if accessToken is provided (not for request token)
  if (accessToken) {
    oauthParams.oauth_token = accessToken;
  }

  // Step 2: Merge all parameters
  const allParams = { ...params, ...oauthParams };

  // Step 3: Normalize parameters (sort and encode)
  const normalizedParams = Object.keys(allParams)
    .sort()
    .map((key) => `${encodeRFC3986(key)}=${encodeRFC3986(allParams[key])}`)
    .join("&");

  // Step 4: Create signature base string
  const baseString = [
    method.toUpperCase(),
    encodeRFC3986(url),
    encodeRFC3986(normalizedParams),
  ].join("&");

  // Step 5: Create signing key
  // For request token, accessTokenSecret is empty, so we just use consumerSecret&
  const signingKey = accessTokenSecret
    ? `${encodeRFC3986(consumerSecret)}&${encodeRFC3986(accessTokenSecret)}`
    : `${encodeRFC3986(consumerSecret)}&`;

  // Step 6: Generate signature
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  // Step 7: Add signature to OAuth params
  oauthParams.oauth_signature = signature;

  // Step 8: Create Authorization header
  const authHeader = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeRFC3986(key)}="${encodeRFC3986(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${authHeader}`;
}

/**
 * RFC 3986 encoding (used by OAuth 1.0a)
 */
function encodeRFC3986(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

/**
 * Create OAuth 1.0a Authorization header for a request
 */
export function createOAuth1Header(
  method: string,
  url: string,
  bodyParams: Record<string, string> = {},
  credentials: OAuth1Credentials
): string {
  return generateOAuth1Signature(method, url, bodyParams, credentials);
}

/**
 * Extract parameters from FormData for OAuth 1.0a signing
 * Note: This is a simplified version. For multipart/form-data, 
 * we only sign the non-file parameters
 */
export function extractFormDataParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  // FormData entries() doesn't work in all environments, so we'll handle it differently
  // For now, we'll pass params separately when using FormData
  return params;
}

/**
 * Parse URL to get base URL and query parameters separately
 */
export function parseUrl(url: string): {
  baseUrl: string;
  queryParams: Record<string, string>;
} {
  const urlObj = new URL(url);
  const queryParams: Record<string, string> = {};
  
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  return {
    baseUrl: `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`,
    queryParams,
  };
}
