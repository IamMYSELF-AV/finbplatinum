# FINB Platinum — Fake International Bank

A fresh, platinum-vibes **web game simulation** of a virtual bank: register with a
username, get a shiny Platinum card (zero balance), link Google for **100 free
credits**, then send credits, trade an automatically moving stock market, add
friends, request credits, and earn more through daily/hourly bonuses and
arcade mini-games.

> Credits are game-only and have no real-world value.

## Tech stack

- **React 18 + Vite** (single-page web app — no native wrapper)
- **Firebase Auth** (username/password via synthetic emails + Google)
- **Cloud Firestore** with hard security rules (`firestore.rules`)
- Fully deterministic, **automatic** stock market (no admin/manual prices,
  no server to cheat) — prices tick every 20 s for every player identically

## Features

- 💳 Auto-issued card: number (Luhn-valid), CVV, expiry, holder name
- 🔐 Free registration — username (`@billgates`), name, password; **no activation code**
- 🎁 Google linking grants a one-time **100-credit** welcome bonus
- 💸 Transfers by **card number or @username** (auto-resolve, live preview)
- 🤝 Friends: add / accept / decline; one-tap send; **request credits** from friends
- 📈 Platimarkets: 8 stocks, live sparklines, intraday charts, buy/sell,
  portfolio value + realized P/L, prices move automatically every 20 s
- 🎮 Games: daily **Platinum Spin** (up to 500), **High Roller** dice (25 plays/day),
  **Memory Match** (20 rounds/day), **Gem Catcher** (15 runs/day)
- 🎁 Earn page: hourly loyalty bonus, daily login streak, auto-rotating community poll
- 🏆 Live leaderboard, transaction history, net worth, card details with reveal

## Security model

Balances can **never** be edited directly by clients. Every balance change must
ship in the same committed write as a validated ledger document:

- transfers → an `orders/{id}` doc (created `pending`, then `settled`)
- stock trades → a `trades/{id}` doc (same two-phase pattern)
- rewards → a `claims/{id}` doc with per-kind caps and id-embedded ownership

See `firestore.rules` for the full validation. Usernames are reserved in
`usernames/{name}`; CVV/expiry live in `private/{uid}` readable only by owner.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

## Deploy

The Firebase project is **finbplatinum** (config lives in `src/firebase.js`).

1. Enable **Email/Password** and **Google** sign-in in Firebase Console → Auth.
2. Create the Firestore database.
3. Deploy rules (required or all writes will be denied):

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

4. Build & host (Firebase Hosting config is included in `firebase.json`):

```bash
npm run build
firebase deploy --only hosting
```

The repo also includes `public/_redirects` for Netlify-style static hosts.

## Project layout

```
src/
  firebase.js          Firebase init, auth helpers
  lib/
    bank.js            Firestore economy engine (transfers, trades, claims, friends…)
    market.js          Deterministic auto stock-market engine
    cards.js           Card/CVV/expiry generation
  components/
    ui.jsx             Toasts, modal, sparkline, card visual, countdown
    games/             SpinWheel, DiceGame, MemoryGame, CatchGame
  pages/               Auth, Dashboard, Transfer, Friends, Market, Games, Earn, Card
firestore.rules        Security rules (deploy these!)
firebase.json          Hosting + rules config
```
