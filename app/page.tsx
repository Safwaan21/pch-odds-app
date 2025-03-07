"use client";

import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useState, useEffect } from "react";
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
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");

  useEffect(() => {
    // Determine the socket URL based on the environment
    const socketUrl = process.env.NODE_ENV === 'production'
      ? `${window.location.origin}/api/socket` // Production URL
      : 'http://localhost:3001'; // Development URL

    const socketOptions = process.env.NODE_ENV === 'production'
      ? { path: '/api/socket' } // Production options
      : {}; // Development options

    console.log(`Connecting to socket at ${socketUrl}`, socketOptions);
    
    const usedSocket = io(socketUrl, socketOptions);

    usedSocket.on("connect", () => {
      console.log("connected to server");
      setConnectionStatus("Connected");
    });

    usedSocket.on("disconnect", () => {
      console.log("disconnected from server");
      setConnectionStatus("Disconnected");
    });

    // Server assigns a role to the connection
    usedSocket.on("role", (data) => {
      console.log("assigned role:", data.role);
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

    // Cleanup on unmount
    return () => {
      usedSocket.disconnect();
    };
  }, []); // Empty dependency array as we only want to run this once

  // Handle player leaving when role changes
  useEffect(() => {
    if (role === "player" && socket) {
      // If a player leaves, reset the game phase for players.
      socket.on("userLeave", () => {
        setGamePhase("waitingOdds");
      });
    }
  }, [role, socket]);

  const handleJoin = () => {
    if (name.trim() !== "" && socket) {
      console.log("Joining game as:", name);
      socket.emit("join", { name });
    }
  };

  const handleSetOdds = () => {
    if (odds.trim() !== "" && socket) {
      const oddsNumber = Number(odds);
      console.log("Setting odds:", oddsNumber);
      socket.emit("setOdds", { odds: oddsNumber });
    }
  };

  const handleSubmitGuess = () => {
    if (guess.trim() !== "" && socket) {
      const guessNumber = Number(guess);
      console.log("Submitting guess:", guessNumber);
      socket.emit("submitGuess", { guess: guessNumber });
    }
  };

  const renderJoin = () => (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button onClick={handleJoin}>Join Game</Button>
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
      />
      <Button onClick={handleSetOdds}>Set Odds & Start Timer</Button>
    </div>
  );

  const renderCountdown = () => (
    <div className="text-center">
      <p className="text-2xl font-bold">Game starting in: {countdown} seconds</p>
      <p>Get ready to make your guess!</p>
    </div>
  );

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

  const renderGuess = () => (
    <div className="flex flex-col gap-4">
      <p className="text-xl font-bold">Time to submit your guess number:</p>
      <p>Enter a number. If both players guess the same number, ODDS WIN!</p>
      <Input
        placeholder="Enter your guess"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        type="number"
      />
      <Button onClick={handleSubmitGuess}>Submit Guess</Button>
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
      <div className="text-sm mb-2">Status: {connectionStatus} | Players: {numUsers}/2</div>
      
      {gamePhase === "join" && renderJoin()}
      {role === "player" && gamePhase === "waitingOdds" && renderWaitingOdds()}
      {role === "player" && gamePhase === "countdown" && renderCountdown()}
      {role === "player" && gamePhase === "guessing" && renderGuess()}
      {role === "player" && gamePhase === "result" && renderResult()}
      {role === "spectator" && renderSpectate()}
    </div>
  );
}
