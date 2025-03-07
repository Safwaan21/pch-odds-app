import { NextResponse } from 'next/server';
import * as Ably from 'ably';

export async function GET() {
  try {
    const client = new Ably.Realtime(process.env.ABLY_API_KEY as string);
    const tokenRequest = await new Promise<any>((resolve, reject) => {
      client.auth.createTokenRequest({ clientId: 'pch-odds-app-' + Math.random().toString(36).substring(2, 15) }, null, (err, tokenRequest) => {
        if (err) {
          reject(err);
        } else {
          resolve(tokenRequest);
        }
      });
    });
    
    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('Error creating Ably token request:', error);
    return NextResponse.json({ error: 'Error creating token request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 