# Finance Tracker — MoneyMind

A full-stack personal finance tracker with SMS auto-import.

## Structure

- `client/` — React frontend (Create React App + Tailwind)
- `server/` — Node.js/Express backend (MongoDB + Gemini AI)

## Local setup

### Server

```
cd server
npm install
cp .env.example .env   # fill in your values
npm start
```

### Client

```
cd client
npm install
cp .env.example .env   # set REACT_APP_API_URL=http://localhost:5000/api
npm start
```

## SMS integration

Uses SMS Forwarder (Webhook) Android app.
See deployment docs for webhook URL setup.
