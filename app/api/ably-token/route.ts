import { NextResponse } from 'next/server';
import Ably from 'ably/promises';

export async function GET() {
  try {
    const client = new Ably.Rest(process.env.ABLY_API_KEY as string);
    const tokenRequest = await client.auth.createTokenRequest({ clientId: 'pch-odds-app-' + Math.random().toString(36).substring(2, 15) });
    
    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('Error creating Ably token request:', error);
    return NextResponse.json({ error: 'Error creating token request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 