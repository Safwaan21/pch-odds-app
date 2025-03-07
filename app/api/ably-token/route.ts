import { NextResponse } from 'next/server';
import * as Ably from 'ably';

export async function GET() {
  try {
    // Create an Ably REST client
    const client = new Ably.Rest(process.env.ABLY_API_KEY as string);
    
    // Create a token request
    const tokenParams = { clientId: 'pch-odds-app-' + Math.random().toString(36).substring(2, 15) };
    const tokenRequest = await client.auth.createTokenRequest(tokenParams);
    
    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('Error creating Ably token request:', error);
    return NextResponse.json({ error: 'Error creating token request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 