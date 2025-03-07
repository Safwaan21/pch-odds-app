"use client";

import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { supabase, EVENTS, GAME_CHANNEL, PLAYER_CHANNEL, GameState } from '@/lib/supabase';

export default function Home() {
  // Player state
  const [playerId, setPlayerId] = useState<string>('');
  const [name, setName] = useState("");
  const [odds, setOdds] = useState("");
  const [guess, setGuess] = useState("");
  const [role, setRole] = useState<"player" | "spectator" | "none">("none");
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    spectators: [],
    phase: 'join',
    countdown: 0,
    result: null
  });
  
  // UI state
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Initialize Supabase realtime connection
  const initializeSupabase = useCallback(async () => {
    try {
      setConnectionStatus("Connecting...");
      setConnectionError(null);
      
      // Generate a unique player ID
      const newPlayerId = 'player-' + Math.random().toString(36).substring(2, 15);
      setPlayerId(newPlayerId);
      
      // Subscribe to game state updates
      const gameStateSubscription = supabase
        .channel(GAME_CHANNEL)
        // @ts-expect-error - Supabase types are not up to date
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: GAME_CHANNEL,
          filter: `event=eq.${EVENTS.GAME_STATE_UPDATE}`
        }, (payload) => {
          console.log('Game state update:', payload.new.payload);
          setGameState(payload.new.payload);
        })
        .subscribe((status) => {
          console.log('Game channel status:', status);
          if (status === 'SUBSCRIBED') {
            setConnectionStatus("Connected");
            setConnectionError(null);
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus("Connection error");
            setConnectionError("Failed to connect to game channel");
          }
        });
      
      // Subscribe to player-specific updates
      const playerSubscription = supabase
        .channel(PLAYER_CHANNEL)
        // @ts-expect-error - Supabase types are not up to date
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: PLAYER_CHANNEL,
          filter: `payload->playerId=eq.${newPlayerId}`
        }, (payload) => {
          if (payload.new.event === EVENTS.ROLE_ASSIGNED) {
            console.log('Role assigned:', payload.new.payload.role);
            setRole(payload.new.payload.role);
          }
        })
        .subscribe();
      
      // Fetch initial game state
      try {
        // @ts-expect-error - Supabase types are not up to date
        const { data } = await supabase
          .from(GAME_CHANNEL)
          .select('payload')
          .eq('event', EVENTS.GAME_STATE_UPDATE)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (data && data.length > 0) {
          setGameState(data[0].payload);
        }
      } catch (error) {
        console.error('Error fetching initial game state:', error);
      }
      
      // Return cleanup function
      return () => {
        gameStateSubscription.unsubscribe();
        playerSubscription.unsubscribe();
      };
    } catch (error) {
      console.error("Supabase initialization error:", error);
      setConnectionStatus("Failed to connect");
      setConnectionError(`${error}`);
      return undefined;
    }
  }, []);

  // Initialize Supabase on component mount
  useEffect(() => {
    const cleanup = initializeSupabase();
    
    return () => {
      if (cleanup) {
        Promise.resolve(cleanup).then(fn => {
          if (typeof fn === 'function') fn();
        });
      }
    };
  }, [initializeSupabase]);

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState.phase === 'countdown' && gameState.countdown > 0) {
      timer = setInterval(() => {
        setGameState(prev => ({
          ...prev,
          countdown: prev.countdown - 1
        }));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState.phase, gameState.countdown]);

  // Handle reconnection
  const handleReconnect = () => {
    initializeSupabase();
  };

  // Game action handlers
  const sendGameAction = async (action: string, data: Record<string, unknown> = {}) => {
    if (connectionStatus !== "Connected") {
      setConnectionError("Not connected to server. Please try reconnecting.");
      return;
    }
    
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          playerId,
          ...data
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error sending ${action}:`, errorData);
        setConnectionError(`Error: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error sending ${action}:`, error);
      setConnectionError(`Error: ${error}`);
    }
  };

  const handleJoin = () => {
    if (name.trim() !== "" && connectionStatus === "Connected") {
      console.log("Joining game as:", name);
      sendGameAction('join', { name });
    }
  };

  const handleSetOdds = () => {
    if (odds.trim() !== "" && connectionStatus === "Connected") {
      const oddsNumber = Number(odds);
      console.log("Setting odds:", oddsNumber);
      sendGameAction('setOdds', { odds: oddsNumber });
    }
  };

  const handleSubmitGuess = () => {
    if (guess.trim() !== "" && connectionStatus === "Connected") {
      const guessNumber = Number(guess);
      console.log("Submitting guess:", guessNumber);
      sendGameAction('submitGuess', { guess: guessNumber });
    }
  };

  // UI Components
  const renderConnectionStatus = () => (
    <div className="text-sm mb-4">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          connectionStatus === "Connected" ? "bg-green-500" : 
          connectionStatus === "Connecting..." ? "bg-yellow-500" : "bg-red-500"
        }`}></div>
        <span>Status: {connectionStatus} | Players: {gameState.players.length}/2</span>
      </div>
      {connectionError && (
        <div className="text-red-500 mt-1 text-xs">{connectionError}</div>
      )}
      {connectionStatus !== "Connected" && (
        <Button 
          onClick={handleReconnect} 
          className="mt-2 text-xs py-1 px-2 h-auto"
          variant="outline"
        >
          Reconnect
        </Button>
      )}
    </div>
  );

  const renderJoin = () => (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={connectionStatus !== "Connected"}
      />
      <Button 
        onClick={handleJoin}
        disabled={connectionStatus !== "Connected" || !name.trim()}
      >
        Join Game
      </Button>
    </div>
  );

  const renderWaitingOdds = () => (
    <div className="flex flex-col gap-4">
      <p>
        Waiting for both players. Enter an odds number and click start when
        ready.
      </p>
      <Input
        placeholder="Enter odds number"
        value={odds}
        onChange={(e) => setOdds(e.target.value)}
        type="number"
        disabled={connectionStatus !== "Connected"}
      />
      <Button 
        onClick={handleSetOdds}
        disabled={connectionStatus !== "Connected" || !odds.trim()}
      >
        Set Odds & Start Timer
      </Button>
    </div>
  );

  const renderCountdown = () => (
    <div className="text-center">
      <p className="text-2xl font-bold">Game starting in: {gameState.countdown} seconds</p>
      <p>Get ready to make your guess!</p>
    </div>
  );

  const renderGuess = () => (
    <div className="flex flex-col gap-4">
      <p className="text-xl font-bold">Time to submit your guess number:</p>
      <p>Enter a number. If both players guess the same number, ODDS WIN!</p>
      <Input
        placeholder="Enter your guess"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        type="number"
        disabled={connectionStatus !== "Connected"}
      />
      <Button 
        onClick={handleSubmitGuess}
        disabled={connectionStatus !== "Connected" || !guess.trim()}
      >
        Submit Guess
      </Button>
    </div>
  );

  const renderResult = () => (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-2xl font-bold">Game Result:</p>
      <p>Player 1 Guess: {gameState.result?.guess1}</p>
      <p>Player 2 Guess: {gameState.result?.guess2}</p>
      <p className="text-3xl font-bold mt-4">
        {gameState.result?.oddsWon ? "ODDS WON! 🎉" : "ODDS LOST! 😢"}
      </p>
      <p>{gameState.result?.message}</p>
      <p className="mt-4 text-sm">Waiting for next round...</p>
    </div>
  );

  const renderSpectate = () => (
    <div className="text-center">
      <p className="text-xl">You are spectating. Waiting for game results...</p>
      {gameState.phase === 'result' && renderResult()}
    </div>
  );

  return (
    <div className="mx-auto flex flex-col items-center justify-center min-h-screen gap-6 p-4">
      <h1 className="text-3xl font-bold mb-4">PCH Odds Game</h1>
      {renderConnectionStatus()}
      
      {gameState.phase === 'join' && role === 'none' && renderJoin()}
      {role === "player" && gameState.phase === 'waitingOdds' && renderWaitingOdds()}
      {role === "player" && gameState.phase === 'countdown' && renderCountdown()}
      {role === "player" && gameState.phase === 'guessing' && renderGuess()}
      {role === "player" && gameState.phase === 'result' && renderResult()}
      {role === "spectator" && renderSpectate()}
    </div>
  );
}
