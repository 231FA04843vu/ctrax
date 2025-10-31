
# CTrax - Frontend

React + Vite + Tailwind v4 + @tailwindcss/postcss + OpenStreetMap (React-Leaflet)

## Run locally
1. Install dependencies  
   ```bash
   npm install
   ```
2. Start dev server  
   ```bash
   npm run dev
   ```

Then open http://localhost:5173  
No API keys needed — uses OpenStreetMap tiles.

## Firebase (Realtime Database)

This project can store users in Firebase Realtime Database instead of localStorage.

1) Create a Firebase project → Enable Realtime Database (in test mode for development).
2) Add a Web App in Firebase Console to get config values.
3) Copy `.env.example` to `.env.local` and fill the `VITE_FIREBASE_*` values.

Minimal database rules for development (allow read/write for authenticated or test):

```
{
   "rules": {
      ".read": true,
      ".write": true
   }
}
```

Data shape:
- `users/student/{id}` → Student profile (name, email, busNo, rollNo, parentPhone, stop, password for demo)
- `users/driver/{id}` → Driver profile (name, email, busNo, phone, password for demo)

Notes:
- Session remains on the client (localStorage) for now; user records live in Firebase.
- For production, replace the demo password storage with Firebase Auth.

