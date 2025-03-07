-- Create tables for the game
CREATE TABLE IF NOT EXISTS "game-channel" (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "player-updates" (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS game_channel_event_idx ON "game-channel" (event);
CREATE INDEX IF NOT EXISTS player_updates_event_idx ON "player-updates" (event);

-- Enable realtime for these tables
ALTER TABLE "game-channel" REPLICA IDENTITY FULL;
ALTER TABLE "player-updates" REPLICA IDENTITY FULL;

-- Enable row level security
ALTER TABLE "game-channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player-updates" ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (for demo purposes)
CREATE POLICY "Allow public read access to game-channel" 
  ON "game-channel" FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to game-channel" 
  ON "game-channel" FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to player-updates" 
  ON "player-updates" FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to player-updates" 
  ON "player-updates" FOR INSERT WITH CHECK (true); 