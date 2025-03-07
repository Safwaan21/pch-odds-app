# PCH Odds Game

A real-time multiplayer game where players set odds and make guesses. If both players guess the same number, ODDS WIN!

## Features

- Real-time multiplayer gameplay using Supabase Realtime
- Support for up to 2 active players and unlimited spectators
- Countdown timer between game phases
- Responsive design

## How to Play

1. Enter your name and join the game
2. First two players become active players, others become spectators
3. Both players set an "odds" number
4. After a 5-second countdown, players make their guesses
5. If both players guess the same number, ODDS WIN!
6. If guesses are different, ODDS LOSE
7. Game automatically resets for the next round

## Supabase Setup

This app uses Supabase for real-time functionality. Follow these steps to set up your Supabase project:

1. Create a free Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to the SQL Editor and run the SQL from `supabase/migrations/20240307_initial_schema.sql`
4. Go to Project Settings > API to get your project URL and anon key
5. Add these to your environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## Testing Locally

Before deploying to production, it's important to test your Supabase integration locally:

1. Copy `.env.local.example` to `.env.local` and add your Supabase credentials
2. Run the Supabase test script to verify your connection:
   ```bash
   npm run test:supabase
   ```
3. The test script will:
   - Verify connection to your Supabase project
   - Test inserting data into the required tables
   - Test querying data from the tables
   - Test realtime subscriptions
   
4. If all tests pass, you're ready to run the full application:
   ```bash
   npm run dev
   ```
   
5. For a complete test, open two browser windows and play against yourself:
   - Open http://localhost:3000 in two different browsers or incognito windows
   - Join as different players in each window
   - Follow the game flow to verify everything works
   
6. You can also use the test page to verify your Supabase connection:
   - Open http://localhost:3000/test in your browser
   - This page provides tools to test your Supabase connection and real-time functionality

## Troubleshooting

If the tests fail, check the following:

1. **Connection Issues**:
   - Verify your Supabase URL and anon key are correct
   - Check that your Supabase project is active
   
2. **Table Creation Issues**:
   - Make sure you've run the SQL migration script
   - Check for any errors in the SQL Editor
   
3. **Realtime Issues**:
   - Ensure Realtime is enabled in your Supabase project
   - Go to Database > Replication > Realtime and make sure it's turned on
   - Add the tables to the allowed tables list if necessary

## Deployment on Vercel

This app is designed to be deployed on Vercel with zero configuration.

### Manual Deployment Steps

1. Push your code to a GitHub repository
2. Go to [Vercel](https://vercel.com) and sign up or log in
3. Click "New Project" and import your GitHub repository
4. Add the Supabase environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Keep all other default settings and click "Deploy"
6. Wait for the deployment to complete
7. Your app is now live at your Vercel URL!

## Local Development

To run the app locally:

```bash
# Install dependencies
npm install

# Set up environment variables
# Copy .env.local.example to .env.local and add your Supabase credentials

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## Technologies Used

- Next.js 15
- React 19
- Supabase Realtime
- TypeScript
- Tailwind CSS
