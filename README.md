# Olives - Idle Game

A simple idle game where you collect olives and produce olive oil!

## About

This is a static web-based idle game built with HTML, CSS, and vanilla JavaScript. No backend required!

## Running Locally

Simply open `index.html` in your web browser, or use a local server:

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx http-server

# VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then navigate to `http://localhost:8000`

## Game Features

- **Harvest Olives**: Click to manually harvest olives (3 second timer)
- **Press Oil**: Convert 10 olives into 1 oil (5 second timer)
- **Hire Olive Harvesters**: Automated olive harvesting (costs 10 oil, produces 1 olive every 15 seconds)
- **Hire Press Workers**: Automated oil pressing (costs 25 oil, produces 1 oil every 30 seconds)
- **Progress Bars**: Visual countdown timers for all actions
- **Auto-Save**: Game state automatically saves to browser localStorage
- **Debug Panel**: Click the ⚒️ button for debug tools (reset game, add resources)

## Deployment

This is a static site that can be deployed to any static hosting service:

### GitHub Pages
1. Push your code to GitHub
2. Go to Settings → Pages
3. Select your branch (usually `main`)
4. Your site will be live at `https://username.github.io/repository-name`

### Netlify
1. Connect your GitHub repository
2. Netlify auto-deploys on every push
3. No build command needed

### Vercel
1. Import your GitHub repository
2. Auto-deploys on every push
3. No configuration needed

### Cloudflare Pages
1. Connect your GitHub repository
2. Set build output directory to `.` (root)
3. Auto-deploys on every push

## Project Structure

```
IdleGame1/
├── index.html          # Main game page
├── static/
│   ├── css/
│   │   └── style.css   # Game styling
│   └── js/
│       └── game.js     # Game logic and state management
└── README.md
```

## Technologies Used

- HTML5
- CSS3 (with CSS animations)
- Vanilla JavaScript (ES6+)
- LocalStorage API for save persistence

## Design Principles

> Every new system should change what the player values, not just add production.
> Florins exist to measure value and recontextualize olives and oil.
