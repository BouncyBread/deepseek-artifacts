import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  authenticated: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "recipeforge-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function verifyAuth(): Promise<boolean> {
  const session = await getSession();
  return session.authenticated === true;
}
