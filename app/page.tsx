"use client";

import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useState, useEffect, useCallback } from "react";
import * as Ably from 'ably';

export default function Home() {
  const [ably, setAbly] = useState<Ably.Realtime | null>(null);
  const [_channel, setChannel] = useState<any>(null);
  const [clientId, setClientId] = useState<string>('');
  const [numUsers, setNumUsers] = useState(0);
  const [role, setRole] = useState<"player" | "spectator" | "none">("none");
  const [name, setName] = useState("");
  const [odds, setOdds] = useState("");
  const [guess, setGuess] = useState("");
  const [gamePhase, setGamePhase] = useState("join"); // "join", "waitingOdds", "countdown", "guessing", "result", "spectate"
  const [result, setResult] = useState<{
    guess1?: number;
    guess2?: number;
    oddsWon?: boolean;
    message?: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Initialize Ably connection
  const initializeAbly = useCallback(async () => {
    try {
      setConnectionStatus("Connecting...");
      setConnectionError(null);
      
      // Generate a unique client ID
      const newClientId = 'pch-odds-app-' + Math.random().toString(36).substring(2, 15);
      setClientId(newClientId);
      
      // Get token from our API
      const tokenResponse = await fetch('/api/ably-token');
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        setConnectionStatus("Failed to connect");
        setConnectionError(`Token error: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      const tokenData = await tokenResponse.json();
      
      // Initialize Ably with the token
      const ablyInstance = new Ably.Realtime({ 
        authCallback: async (_, callback) => {
          callback(null, tokenData);
        },
        clientId: newClientId
      });
      
      // Set up connection state change handler
      ablyInstance.connection.on('connected', () => {
        console.log('Connected to Ably');
        setConnectionStatus("Connected");
        setConnectionError(null);
      });
      
      ablyInstance.connection.on('failed', (err: any) => {
        console.error('Ably connection failed:', err);
        setConnectionStatus("Connection failed");
        setConnectionError(err.message || 'Connection failed');
      });
      
      ablyInstance.connection.on('disconnected', () => {
        console.log('Disconnected from Ably');
        setConnectionStatus("Disconnected");
      });
      
      // Subscribe to the game channel
      const gameChannel = ablyInstance.channels.get('game-channel');
      
      // Set up event handlers
      gameChannel.subscribe('role', (message) => {
        // Only process messages intended for this client
        if (message.data.clientId === newClientId) {
          console.log("Assigned role:", message.data.role);
          setRole(message.data.role);
          if (message.data.role === "player") {
            setGamePhase("waitingOdds");
          } else {
            setGamePhase("spectate");
          }
        }
      });
      
      gameChannel.subscribe('userJoin', (message) => {
        console.log("User joined, player count:", message.data.playersCount);
        setNumUsers(message.data.playersCount);
      });
      
      gameChannel.subscribe('userLeave', (message) => {
        console.log("User left, player count:", message.data.playersCount);
        setNumUsers(message.data.playersCount);
      });
      
      gameChannel.subscribe('waitingForOdds', (message) => {
        console.log("Waiting for odds:", message.data.message);
        setGamePhase("waitingOdds");
      });
      
      gameChannel.subscribe('startTimer', (message) => {
        console.log("Starting countdown:", message.data.countdown);
        setCountdown(message.data.countdown);
        setGamePhase("countdown");
      });
      
      gameChannel.subscribe('timerEnded', (message) => {
        console.log("Timer ended, time to guess:", message.data.message);
        setGamePhase("guessing");
      });
      
      gameChannel.subscribe('gameResult', (message) => {
        console.log("Game result received:", message.data);
        setResult(message.data);
        setGamePhase("result");
      });
      
      setAbly(ablyInstance);
      setChannel(gameChannel);
      
      return () => {
        console.log("Cleaning up Ably connection");
        gameChannel.unsubscribe();
        ablyInstance.close();
      };
    } catch (error) {
      console.error("Ably initialization error:", error);
      setConnectionStatus("Failed to connect");
      setConnectionError(`${error}`);
      return undefined;
    }
  }, []);

  // Initialize Ably on component mount
  useEffect(() => {
    const cleanupFn = initializeAbly();
    
    return () => {
      Promise.resolve(cleanupFn).then(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, [initializeAbly]);

  // Countdown timer (updates every second)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gamePhase === "countdown" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gamePhase, countdown]);

  // Handle reconnection
  const handleReconnect = () => {
    if (ably) {
      ably.close();
    }
    initializeAbly();
  };

  // Game action handlers
  const sendGameAction = async (action: string, data: Record<string, any> = {}) => {
    if (connectionStatus !== "Connected") {
      setConnectionError("Not connected to server. Please try reconnecting.");
      return;
    }
    
    try {
      const response = await fetch('/api/game-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          clientId,
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
        <span>Status: {connectionStatus} | Players: {numUsers}/2</span>
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
      <p className="text-2xl font-bold">Game starting in: {countdown} seconds</p>
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
      <p>Player 1 Guess: {result?.guess1}</p>
      <p>Player 2 Guess: {result?.guess2}</p>
      <p className="text-3xl font-bold mt-4">
        {result?.oddsWon ? "ODDS WON! 🎉" : "ODDS LOST! 😢"}
      </p>
      <p>{result?.message}</p>
      <p className="mt-4 text-sm">Waiting for next round...</p>
    </div>
  );

  const renderSpectate = () => (
    <div className="text-center">
      <p className="text-xl">You are spectating. Waiting for game results...</p>
      {gamePhase === "result" && renderResult()}
    </div>
  );

  return (
    <div className="mx-auto flex flex-col items-center justify-center min-h-screen gap-6 p-4">
      <h1 className="text-3xl font-bold mb-4">PCH Odds Game</h1>
      {renderConnectionStatus()}
      
      {gamePhase === "join" && renderJoin()}
      {role === "player" && gamePhase === "waitingOdds" && renderWaitingOdds()}
      {role === "player" && gamePhase === "countdown" && renderCountdown()}
      {role === "player" && gamePhase === "guessing" && renderGuess()}
      {role === "player" && gamePhase === "result" && renderResult()}
      {role === "spectator" && renderSpectate()}
    </div>
  );
}
