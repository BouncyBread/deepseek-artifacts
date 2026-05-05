import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { passphrase } = await request.json();
    const expected = process.env.APP_PASSPHRASE;

    if (!expected || passphrase !== expected) {
      return NextResponse.json(
        { error: "Invalid passphrase" },
        { status: 401 }
      );
    }

    const session = await getSession();
    session.authenticated = true;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  return NextResponse.json({
    authenticated: session.authenticated === true,
  });
}
