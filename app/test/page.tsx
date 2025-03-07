"use client";

import { useState, useEffect } from "react";
import { supabase, GAME_CHANNEL, EVENTS } from '@/lib/supabase';
import { Button } from "@/components/ui/button";

export default function TestPage() {
  const [status, setStatus] = useState<string>("Checking connection...");
  const [messages, setMessages] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [receivedEvents, setReceivedEvents] = useState<number>(0);

  // Add a log message
  const addLog = (message: string) => {
    setMessages(prev => [...prev, `${new Date().toISOString().substring(11, 19)} - ${message}`]);
  };

  // Check connection on load
  useEffect(() => {
    const checkConnection = async () => {
      try {
        addLog("Checking Supabase connection...");
        
        // Try to query a non-existent table to check connection
        const { error } = await supabase.from('_connection_test').select('*').limit(1);
        
        if (error && error.code !== "42P01") { // 42P01 is the error code for "relation does not exist"
          setStatus("Connection failed: " + error.message);
          addLog("❌ Connection failed: " + error.message);
          setIsConnected(false);
        } else {
          setStatus("Connected to Supabase");
          addLog("✅ Connected to Supabase");
          setIsConnected(true);
        }
      } catch (error) {
        setStatus("Connection error");
        addLog("❌ Connection error: " + (error as Error).message);
        setIsConnected(false);
      }
    };
    
    checkConnection();
  }, []);

  // Subscribe to realtime updates
  const handleSubscribe = async () => {
    try {
      addLog("Subscribing to realtime updates...");
      
      const channel = supabase
        .channel('test-channel')
        // @ts-expect-error - Supabase types are not up to date
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: GAME_CHANNEL 
        }, (payload) => {
          addLog(`✅ Received event: ${payload.new.event}`);
          setReceivedEvents(prev => prev + 1);
        })
        .subscribe((status) => {
          addLog(`Subscription status: ${status}`);
          if (status === 'SUBSCRIBED') {
            setIsSubscribed(true);
            addLog("✅ Successfully subscribed to realtime updates");
          } else {
            setIsSubscribed(false);
          }
        });
        
      return () => {
        channel.unsubscribe();
      };
    } catch (error) {
      addLog("❌ Subscription error: " + (error as Error).message);
    }
  };

  // Send a test event
  const handleSendEvent = async () => {
    try {
      addLog("Sending test event...");
      
      const { error } = await supabase
        .from(GAME_CHANNEL)
        .insert({
          event: 'test_event',
          payload: { 
            test: true, 
            timestamp: new Date().toISOString(),
            message: "This is a test event"
          }
        });
        
      if (error) {
        addLog("❌ Failed to send event: " + error.message);
      } else {
        addLog("✅ Test event sent successfully");
      }
    } catch (error) {
      addLog("❌ Error sending event: " + (error as Error).message);
    }
  };

  // Send a game state update
  const handleSendGameState = async () => {
    try {
      addLog("Sending game state update...");
      
      const testGameState = {
        players: [
          { id: 'test-player-1', name: 'Test Player 1', odds: 5, guess: null },
          { id: 'test-player-2', name: 'Test Player 2', odds: 7, guess: null }
        ],
        spectators: [],
        phase: 'waitingOdds',
        countdown: 5,
        result: null
      };
      
      const { error } = await supabase
        .from(GAME_CHANNEL)
        .insert({
          event: EVENTS.GAME_STATE_UPDATE,
          payload: testGameState
        });
        
      if (error) {
        addLog("❌ Failed to send game state: " + error.message);
      } else {
        addLog("✅ Game state update sent successfully");
      }
    } catch (error) {
      addLog("❌ Error sending game state: " + (error as Error).message);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
      
      <div className="mb-4 p-4 border rounded">
        <p className="font-semibold">Status: <span className={isConnected ? "text-green-500" : "text-red-500"}>{status}</span></p>
        <p>Realtime Subscription: <span className={isSubscribed ? "text-green-500" : "text-yellow-500"}>{isSubscribed ? "Active" : "Not subscribed"}</span></p>
        <p>Events Received: {receivedEvents}</p>
      </div>
      
      <div className="flex gap-2 mb-4">
        <Button onClick={handleSubscribe} disabled={isSubscribed}>
          Subscribe to Realtime
        </Button>
        <Button onClick={handleSendEvent} disabled={!isConnected}>
          Send Test Event
        </Button>
        <Button onClick={handleSendGameState} disabled={!isConnected}>
          Send Game State
        </Button>
      </div>
      
      <div className="border rounded p-4 bg-gray-50 h-96 overflow-y-auto">
        <h2 className="font-semibold mb-2">Log Messages:</h2>
        <div className="space-y-1 font-mono text-sm">
          {messages.map((message, index) => (
            <div key={index} className="border-b pb-1">{message}</div>
          ))}
        </div>
      </div>
      
      <div className="mt-4">
        <h2 className="font-semibold mb-2">Environment Variables:</h2>
        <p>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Not set"}</p>
        <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Not set"}</p>
      </div>
    </div>
  );
} 