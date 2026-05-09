# TactiTrack-C2

A real-time military command dashboard I built for tracking units, detecting threats, and coordinating missions. Built this as a portfolio project to learn full-stack development with real-time features.

**Live:** https://tactitrack-c2.netlify.app/

## What it does

- Units move on a live map in real time using WebSockets
- Route finder calculates shortest path between any two units using Dijkstra's algorithm
- Alerts system with priority levels — critical threats show first
- Commander and Operator login roles using JWT
- Dark tactical UI with boot animation

## Tech used

- Frontend — HTML, CSS, JavaScript, Leaflet.js for maps
- Backend — Node.js, Express.js
- Real-time — Socket.IO
- Database — MongoDB
- Auth — JWT + bcrypt

## How to run

```bash
# Frontend - open in VS Code with Live Server
open frontend/index.html

# Backend
cd backend
npm install
npm run dev
```

## Login credentials

| Role | Username | Password |
|------|----------|----------|
| Commander | commander | cmd@1234 |
| Operator | alpha1 | alpha@1 |

## How it works

The unit positions update every 3 seconds using Socket.IO — this simulates a real GPS IoT device sending location data. The route finder uses Dijkstra's algorithm on a weighted graph where each unit is a node and edge weights are distances in km.

## Built by

Ananya K N
