import { createAuthClient } from "better-auth/react";

const authClientConfig = process.env.NEXT_PUBLIC_APP_URL
  ? { baseURL: process.env.NEXT_PUBLIC_APP_URL }
  : {};

export const authClient = createAuthClient(authClientConfig);

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
