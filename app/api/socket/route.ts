import { Server as SocketIOServer } from 'socket.io';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Store for active connections and game state
let io: SocketIOServer | null = null;
let players: Array<{ socketId: string, name: string, odds: number | null, guess: number | null }> = [];
let spectators: Array<{ socketId: string, name: string }> = [];

// Helper function to remove a socket from our arrays
function removeSocket(socketId: string) {
  players = players.filter((p) => p.socketId !== socketId);
  spectators = spectators.filter((s) => s.socketId !== socketId);
}

export async function GET(request: NextRequest) {
  // This is just a health check endpoint
  return NextResponse.json({ status: 'Socket.io server is running' });
}

export function POST(request: NextRequest) {
  if (io) return NextResponse.json({ status: 'Socket server already running' });

  // Create socket.io server
  // @ts-ignore - Next.js doesn't have proper types for this yet
  const { socket, server } = request;
  
  if (!socket || !server) {
    return NextResponse.json({ error: 'Socket.io server could not be initialized' }, { status: 500 });
  }

  io = new SocketIOServer(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // When a client sends a join request with a name
    socket.on('join', (data) => {
      console.log('Join received:', data);
      if (players.length < 2) {
        // Add as a player if there is an available slot
        players.push({
          socketId: socket.id,
          name: data.name,
          odds: null,
          guess: null,
        });
        socket.emit('role', { role: 'player' });
        io?.emit('userJoin', { playersCount: players.length });
        // When two players are connected, prompt them to set odds
        if (players.length === 2) {
          io?.emit('waitingForOdds', {
            message: 'Both players, please set your odds number.',
          });
        }
      } else {
        // Otherwise, add as a spectator
        spectators.push({
          socketId: socket.id,
          name: data.name,
        });
        socket.emit('role', { role: 'spectator' });
      }
    });

    // Receive the odds number from a player
    socket.on('setOdds', (data) => {
      console.log('setOdds from:', socket.id, data);
      const player = players.find((p) => p.socketId === socket.id);
      if (player) {
        player.odds = data.odds;
        
        // Log the current state of players for debugging
        console.log('Current players state:', players.map(p => ({ 
          id: p.socketId.substring(0, 5), 
          odds: p.odds 
        })));
        
        // Check if both players have set their odds
        const bothPlayersSetOdds = players.length === 2 && 
                                  players[0].odds !== null && 
                                  players[1].odds !== null;
        
        console.log('Both players set odds:', bothPlayersSetOdds);
        
        // Once both players have set their odds, start the countdown
        if (bothPlayersSetOdds) {
          console.log('Starting countdown timer');
          io?.emit('startTimer', { countdown: 5 });
          
          // After 5 seconds, notify players to submit their guess
          setTimeout(() => {
            console.log('Timer ended, prompting for guesses');
            io?.emit('timerEnded', { message: 'Time to submit guess' });
          }, 5000);
        }
      }
    });

    // Receive the guess number from a player
    socket.on('submitGuess', (data) => {
      console.log('submitGuess from:', socket.id, data);
      const player = players.find((p) => p.socketId === socket.id);
      if (player) {
        player.guess = data.guess;
        
        console.log('Current guesses:', players.map(p => ({
          id: p.socketId.substring(0, 5),
          guess: p.guess
        })));
        
        // If both players have submitted a guess, determine the result
        if (players.length === 2 && players.every((p) => p.guess !== null)) {
          // Get the guesses
          const guess1 = players[0].guess;
          const guess2 = players[1].guess;
          
          // Check if the guesses match (ODDS WON) or not (ODDS LOST)
          const oddsWon = guess1 === guess2;
          
          console.log(`Game result: Player 1 guessed ${guess1}, Player 2 guessed ${guess2}, ODDS ${oddsWon ? 'WON' : 'LOST'}`);
          
          // Broadcast the game result to all connected clients
          io?.emit('gameResult', { 
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
          setTimeout(() => {
            io?.emit('waitingForOdds', {
              message: 'Both players, please set your odds number for the next round.',
            });
          }, 5000);
        }
      }
    });

    // When a client leaves (or disconnects), remove them
    socket.on('leave', () => {
      removeSocket(socket.id);
      io?.emit('userLeave', { playersCount: players.length });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      removeSocket(socket.id);
      io?.emit('userLeave', { playersCount: players.length });
    });
  });

  return NextResponse.json({ status: 'Socket.io server started' });
}

export const dynamic = 'force-dynamic'; 