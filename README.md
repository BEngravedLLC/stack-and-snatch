# Stack & Snatch 💰

An online multiplayer card game for 2–6 players: pair up your assets, steal your friends' top sets, and be the first to bank $1,000,000.

## Run it locally
```
npm install
npm start
```
Then open http://localhost:3000. Share the room code or the invite link.

## Put it online (GitHub + Render, same as your other games)
1. Push this folder to a new GitHub repo.
2. On Render: **New → Web Service** → pick the repo.
3. Build command: `npm install` · Start command: `npm start` · Instance: Free is fine.
4. Open the Render URL, create a room, and send friends the invite link.

> Free Render instances sleep after inactivity; the first visit can take ~30–50 s to wake up.

## Features
- Room codes + one-tap invite links, 2–6 players, bots to fill empty seats, "Practice vs Bots" mode
- Upload a profile photo (auto center-cropped) or pick an emoji, plus your name
- Big "YOUR TURN" banner, glowing screen edge, chime, phone vibration, and a flashing browser tab
- Steal showdowns with a live battle panel, countdown, and SNATCHED / DEFENDED effects
- Card hints (PAIR / STEAL tags), double-tap a card to grab its twin, tap the glowing discard pile to pair it
- Chat with emoji reactions that float over players' seats
- Chill lo-fi music and sound effects generated live (volume + mute in ⚙️)
- Reconnect on refresh; disconnected players are covered by autopilot until they return
- Host settings: hand size, target ($250K / $500K / $1M / one round), optional turn timer
- Keyboard: 1–9 select cards, Enter confirms
