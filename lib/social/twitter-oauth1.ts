/**
 * Twitter OAuth 1.0a auth link generation (3-legged flow).
 * Analogous to generateAuthLink in node-twitter-api-v2: returns URL and temporary tokens
 * for the callback step.
 */

import { createOAuth1Header, parseUrl } from "./oauth1";

const REQUEST_TOKEN_URL = "https://api.x.com/oauth/request_token";
const AUTHORIZE_BASE_URL = "https://api.x.com/oauth/authorize";

export interface GenerateTwitterOAuth1AuthLinkParams {
  callbackUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface TwitterOAuth1AuthLinkResult {
  url: string;
  oauth_token: string;
  oauth_token_secret: string;
}

/**
 * Step 1 of OAuth 1.0a: obtain request token and build authorization URL.
 * Caller should store oauth_token and oauth_token_secret (e.g. in Redis keyed by state)
 * and redirect the user to `url`. On callback, exchange oauth_verifier for access token.
 */
export async function generateTwitterOAuth1AuthLink(
  params: GenerateTwitterOAuth1AuthLinkParams
): Promise<TwitterOAuth1AuthLinkResult> {
  const { callbackUrl, consumerKey, consumerSecret } = params;

  const { baseUrl, queryParams } = parseUrl(REQUEST_TOKEN_URL);
  const requestParams: Record<string, string> = {
    oauth_callback: callbackUrl,
  };

  const authHeader = createOAuth1Header(
    "POST",
    baseUrl,
    { ...requestParams, ...queryParams },
    {
      consumerKey,
      consumerSecret,
      accessToken: "",
      accessTokenSecret: "",
    }
  );

  const response = await fetch(REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Twitter OAuth 1.0a request token failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const responseText = await response.text();
  const searchParams = new URLSearchParams(responseText);

  const oauthToken = searchParams.get("oauth_token");
  const oauthTokenSecret = searchParams.get("oauth_token_secret");
  const oauthCallbackConfirmed = searchParams.get("oauth_callback_confirmed");

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error(
      "Twitter OAuth 1.0a response missing oauth_token or oauth_token_secret"
    );
  }

  if (oauthCallbackConfirmed !== "true") {
    throw new Error("Twitter OAuth 1.0a oauth_callback_confirmed is not true");
  }

  const url = `${AUTHORIZE_BASE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;

  return {
    url,
    oauth_token: oauthToken,
    oauth_token_secret: oauthTokenSecret,
  };
}
