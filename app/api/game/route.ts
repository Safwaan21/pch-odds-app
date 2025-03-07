import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabase, EVENTS, GAME_CHANNEL, PLAYER_CHANNEL, GameState, Player } from '@/lib/supabase';

// In-memory game state (will reset on serverless cold starts)
let gameState: GameState = {
  players: [],
  spectators: [],
  phase: 'join',
  countdown: 0,
  result: null
};

// Helper function to broadcast game state updates
async function broadcastGameState() {
  await supabase.from(GAME_CHANNEL).insert({
    event: EVENTS.GAME_STATE_UPDATE,
    payload: gameState
  });
}

// Helper function to remove a player
function removePlayer(playerId: string) {
  gameState.players = gameState.players.filter(p => p.id !== playerId);
  gameState.spectators = gameState.spectators.filter(s => s.id !== playerId);
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'Game server is running',
    players: gameState.players.length,
    spectators: gameState.spectators.length,
    phase: gameState.phase
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, playerId, name, odds, guess } = data;

    switch (action) {
      case 'join':
        if (gameState.players.length < 2) {
          // Add as a player
          const newPlayer: Player = {
            id: playerId,
            name,
            odds: null,
            guess: null
          };
          
          gameState.players.push(newPlayer);
          
          // Notify the player of their role
          await supabase.from(PLAYER_CHANNEL).insert({
            event: EVENTS.ROLE_ASSIGNED,
            payload: {
              playerId,
              role: 'player'
            }
          });
          
          // Update game state for all clients
          await broadcastGameState();
          
          // If two players have joined, prompt for odds
          if (gameState.players.length === 2) {
            gameState.phase = 'waitingOdds';
            await broadcastGameState();
          }
        } else {
          // Add as spectator
          gameState.spectators.push({
            id: playerId,
            name
          });
          
          // Notify the player of their role
          await supabase.from(PLAYER_CHANNEL).insert({
            event: EVENTS.ROLE_ASSIGNED,
            payload: {
              playerId,
              role: 'spectator'
            }
          });
          
          // Update game state for all clients
          await broadcastGameState();
        }
        break;
        
      case 'setOdds':
        const playerForOdds = gameState.players.find(p => p.id === playerId);
        if (playerForOdds) {
          playerForOdds.odds = odds;
          
          // Check if both players have set odds
          const bothPlayersSetOdds = 
            gameState.players.length === 2 && 
            gameState.players[0].odds !== null && 
            gameState.players[1].odds !== null;
          
          if (bothPlayersSetOdds) {
            // Start countdown
            gameState.phase = 'countdown';
            gameState.countdown = 5;
            await broadcastGameState();
            
            // After 5 seconds, move to guessing phase
            setTimeout(async () => {
              gameState.phase = 'guessing';
              await broadcastGameState();
            }, 5000);
          } else {
            // Just update the game state
            await broadcastGameState();
          }
        }
        break;
        
      case 'submitGuess':
        const playerForGuess = gameState.players.find(p => p.id === playerId);
        if (playerForGuess) {
          playerForGuess.guess = guess;
          
          // Check if both players have submitted guesses
          const bothPlayersGuessed = 
            gameState.players.length === 2 && 
            gameState.players[0].guess !== null && 
            gameState.players[1].guess !== null;
          
          if (bothPlayersGuessed) {
            // Determine the result
            const guess1 = gameState.players[0].guess;
            const guess2 = gameState.players[1].guess;
            const oddsWon = guess1 === guess2;
            
            // Update game state with result
            gameState.phase = 'result';
            gameState.result = {
              guess1,
              guess2,
              oddsWon,
              message: oddsWon ? 'ODDS WON! Both guesses match!' : 'ODDS LOST! Guesses don\'t match.'
            };
            
            await broadcastGameState();
            
            // Reset for next round after 5 seconds
            setTimeout(async () => {
              // Reset player guesses and odds
              gameState.players.forEach(p => {
                p.odds = null;
                p.guess = null;
              });
              
              gameState.phase = 'waitingOdds';
              gameState.result = null;
              
              await broadcastGameState();
            }, 5000);
          } else {
            // Just update the game state
            await broadcastGameState();
          }
        }
        break;
        
      case 'leave':
        removePlayer(playerId);
        await broadcastGameState();
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    return NextResponse.json({ 
      status: 'success',
      gameState
    });
  } catch (error) {
    console.error('Game state error:', error);
    return NextResponse.json({ error: 'Game state error', details: error }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 