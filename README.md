# PCH Odds Game

A real-time multiplayer game where players set odds and make guesses. If both players guess the same number, ODDS WIN!

## Features

- Real-time multiplayer gameplay using Socket.io
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

## Deployment on Vercel

This app is designed to be deployed on Vercel with zero configuration. The backend Socket.io server runs as a serverless function.

### Deploy Your Own

Deploy your own version of this app to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSafwaan21%2Fpch-odds-app)

### Manual Deployment Steps

1. Push your code to a GitHub repository
2. Go to [Vercel](https://vercel.com) and sign up or log in
3. Click "New Project" and import your GitHub repository
4. Keep all default settings and click "Deploy"
5. Wait for the deployment to complete
6. Your app is now live at your Vercel URL!

## Local Development

To run the app locally:

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## Technologies Used

- Next.js 15
- React 19
- Socket.io
- TypeScript
- Tailwind CSS
