"use client";

import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
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

  // Initialize Socket.io connection
  const initializeSocket = useCallback(async () => {
    try {
      setConnectionStatus("Connecting...");
      setConnectionError(null);
      
      // First, make a POST request to initialize the Socket.io server
      const initResponse = await fetch('/api/socket', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        console.error('Failed to initialize socket server:', errorData);
        setConnectionStatus("Failed to connect");
        setConnectionError(`Server error: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      // Determine the socket URL and options
      const socketUrl = window.location.origin;
      const socketOptions = {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      };
      
      console.log(`Connecting to socket at ${socketUrl}`, socketOptions);
      
      // Create the socket connection
      const usedSocket = io(socketUrl, socketOptions);
      
      // Set up event handlers
      usedSocket.on("connect", () => {
        console.log("Connected to server with ID:", usedSocket.id);
        setConnectionStatus("Connected");
        setConnectionError(null);
      });
      
      usedSocket.on("connect_error", (err) => {
        console.error("Connection error:", err);
        setConnectionStatus("Connection error");
        setConnectionError(`${err.message}`);
      });

      usedSocket.on("disconnect", (reason) => {
        console.log("Disconnected from server:", reason);
        setConnectionStatus(`Disconnected: ${reason}`);
      });

      // Server assigns a role to the connection
      usedSocket.on("role", (data) => {
        console.log("Assigned role:", data.role);
        setRole(data.role);
        if (data.role === "player") {
          setGamePhase("waitingOdds");
        } else {
          setGamePhase("spectate");
        }
      });

      usedSocket.on("userJoin", (data) => {
        console.log("User joined, player count:", data.playersCount);
        setNumUsers(data.playersCount);
      });

      usedSocket.on("userLeave", (data) => {
        console.log("User left, player count:", data.playersCount);
        setNumUsers(data.playersCount);
      });

      // Tells players to set odds
      usedSocket.on("waitingForOdds", (data) => {
        console.log("Waiting for odds:", data.message);
        setGamePhase("waitingOdds");
      });

      // When both players have submitted odds, the server starts a 5-second timer.
      usedSocket.on("startTimer", (data) => {
        console.log("Starting countdown:", data.countdown);
        setCountdown(data.countdown);
        setGamePhase("countdown");
      });

      // After timer completes, players can submit their guess.
      usedSocket.on("timerEnded", (data) => {
        console.log("Timer ended, time to guess:", data.message);
        setGamePhase("guessing");
      });

      // Game result is broadcast once both players have guessed.
      usedSocket.on("gameResult", (data) => {
        console.log("Game result received:", data);
        setResult(data);
        setGamePhase("result");
      });

      setSocket(usedSocket);
      
      // Return a cleanup function
      return () => {
        console.log("Cleaning up socket connection");
        usedSocket.disconnect();
      };
    } catch (error) {
      console.error("Socket initialization error:", error);
      setConnectionStatus("Failed to connect");
      setConnectionError(`${error}`);
      return undefined; // Return undefined instead of null
    }
  }, []);

  // Initialize socket on component mount
  useEffect(() => {
    const cleanupFn = initializeSocket();
    
    // Handle player leaving when role changes
    if (role === "player" && socket) {
      socket.on("userLeave", () => {
        setGamePhase("waitingOdds");
      });
    }
    
    return () => {
      // Use Promise.resolve to handle both Promise and function returns
      Promise.resolve(cleanupFn).then(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, [initializeSocket, role, socket]);

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
    if (socket) {
      socket.disconnect();
    }
    initializeSocket();
  };

  const handleJoin = () => {
    if (name.trim() !== "" && socket && socket.connected) {
      console.log("Joining game as:", name);
      socket.emit("join", { name });
    } else if (!socket || !socket.connected) {
      setConnectionError("Not connected to server. Please try reconnecting.");
    }
  };

  const handleSetOdds = () => {
    if (odds.trim() !== "" && socket && socket.connected) {
      const oddsNumber = Number(odds);
      console.log("Setting odds:", oddsNumber);
      socket.emit("setOdds", { odds: oddsNumber });
    } else if (!socket || !socket.connected) {
      setConnectionError("Not connected to server. Please try reconnecting.");
    }
  };

  const handleSubmitGuess = () => {
    if (guess.trim() !== "" && socket && socket.connected) {
      const guessNumber = Number(guess);
      console.log("Submitting guess:", guessNumber);
      socket.emit("submitGuess", { guess: guessNumber });
    } else if (!socket || !socket.connected) {
      setConnectionError("Not connected to server. Please try reconnecting.");
    }
  };

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
