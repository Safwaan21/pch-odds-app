import { NextResponse } from 'next/server';
import Ably from 'ably/promises';
import type { NextRequest } from 'next/server';

// Store for game state (note: this will reset on cold starts in serverless)
let players: Array<{ clientId: string, name: string, odds: number | null, guess: number | null }> = [];
let spectators: Array<{ clientId: string, name: string }> = [];

// Helper function to remove a client
function removeClient(clientId: string) {
  players = players.filter((p) => p.clientId !== clientId);
  spectators = spectators.filter((s) => s.clientId !== clientId);
}

// Initialize Ably client
const getAblyClient = () => {
  return new Ably.Rest(process.env.ABLY_API_KEY as string);
};

// This is just a health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'Game server is running',
    players: players.length,
    spectators: spectators.length
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, clientId, name, odds, guess } = data;
    const client = getAblyClient();
    const channel = client.channels.get('game-channel');

    switch (action) {
      case 'join':
        if (players.length < 2) {
          // Add as a player if there is an available slot
          players.push({
            clientId,
            name,
            odds: null,
            guess: null,
          });
          
          // Notify the client of their role
          await channel.publish('role', { 
            clientId, 
            role: 'player' 
          });
          
          // Notify all clients of the new player count
          await channel.publish('userJoin', { 
            playersCount: players.length 
          });
          
          // When two players are connected, prompt them to set odds
          if (players.length === 2) {
            await channel.publish('waitingForOdds', {
              message: 'Both players, please set your odds number.',
            });
          }
        } else {
          // Otherwise, add as a spectator
          spectators.push({
            clientId,
            name,
          });
          
          // Notify the client of their role
          await channel.publish('role', { 
            clientId, 
            role: 'spectator' 
          });
        }
        break;
        
      case 'setOdds':
        const playerForOdds = players.find((p) => p.clientId === clientId);
        if (playerForOdds) {
          playerForOdds.odds = odds;
          
          // Check if both players have set their odds
          const bothPlayersSetOdds = players.length === 2 && 
                                    players[0].odds !== null && 
                                    players[1].odds !== null;
          
          // Once both players have set their odds, start the countdown
          if (bothPlayersSetOdds) {
            await channel.publish('startTimer', { countdown: 5 });
            
            // After 5 seconds, notify players to submit their guess
            setTimeout(async () => {
              await channel.publish('timerEnded', { 
                message: 'Time to submit guess' 
              });
            }, 5000);
          }
        }
        break;
        
      case 'submitGuess':
        const playerForGuess = players.find((p) => p.clientId === clientId);
        if (playerForGuess) {
          playerForGuess.guess = guess;
          
          // If both players have submitted a guess, determine the result
          if (players.length === 2 && players.every((p) => p.guess !== null)) {
            // Get the guesses
            const guess1 = players[0].guess;
            const guess2 = players[1].guess;
            
            // Check if the guesses match (ODDS WON) or not (ODDS LOST)
            const oddsWon = guess1 === guess2;
            
            // Broadcast the game result to all connected clients
            await channel.publish('gameResult', { 
              guess1, 
              guess2, 
              oddsWon,
              message: oddsWon ? 'ODDS WON! Both guesses match!' : 'ODDS LOST! Guesses don\'t match.'
            });
            
            // Reset odds and guess for the next round
            players.forEach((p) => {
              p.odds = null;
              p.guess = null;
            });
            
            // Prompt players to set odds for the next round
            setTimeout(async () => {
              await channel.publish('waitingForOdds', {
                message: 'Both players, please set your odds number for the next round.',
              });
            }, 5000);
          }
        }
        break;
        
      case 'leave':
        removeClient(clientId);
        await channel.publish('userLeave', { 
          playersCount: players.length 
        });
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    return NextResponse.json({ 
      status: 'success',
      players: players.length,
      spectators: spectators.length
    });
  } catch (error) {
    console.error('Game state error:', error);
    return NextResponse.json({ error: 'Game state error', details: error }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 