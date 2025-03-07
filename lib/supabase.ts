import { createClient } from '@supabase/supabase-js';

// These environment variables need to be set in your Vercel project
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Game state types
export interface Player {
  id: string;
  name: string;
  odds: number | null;
  guess: number | null;
}

export interface GameState {
  players: Player[];
  spectators: { id: string; name: string }[];
  phase: 'join' | 'waitingOdds' | 'countdown' | 'guessing' | 'result';
  countdown: number;
  result: {
    guess1?: number;
    guess2?: number;
    oddsWon?: boolean;
    message?: string;
  } | null;
}

// Channel names
export const GAME_CHANNEL = 'game-channel';
export const PLAYER_CHANNEL = 'player-updates';
export const GAME_STATE_CHANNEL = 'game-state';

// Event names
export const EVENTS = {
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave',
  SET_ODDS: 'set_odds',
  SUBMIT_GUESS: 'submit_guess',
  GAME_STATE_UPDATE: 'game_state_update',
  ROLE_ASSIGNED: 'role_assigned',
  COUNTDOWN_START: 'countdown_start',
  COUNTDOWN_END: 'countdown_end',
  GAME_RESULT: 'game_result',
}; 