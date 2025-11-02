# Deploying CTraX

This repo contains:
- React + Vite web app (static) — deploy to Netlify
- Node.js notifications sender (server/index.js) — deploy to Fly.io

## Netlify (Vite site)

1) Build settings
- Build command: `npm run build`
- Publish directory: `dist`

2) Environment variables (Site settings → Environment)
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_DATABASE_URL
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_MEASUREMENT_ID (optional)
- VITE_FIREBASE_VAPID_KEY (Web Push public key from Firebase Console → Cloud Messaging → Web configuration)

3) Web Push service worker config
- Edit `public/firebase-messaging-sw.js` and replace placeholders with your Firebase web config (safe to expose).

After deploy, open the site on Android Chrome, tap “Add to Home screen,” then use the “Enable notifications” panel to get a web push token.

## Fly.io (Notifications sender)

Prereqs: Install flyctl and login.

```bat
# Create app
flyctl launch --no-deploy --name ctrax-notify --region [choose]

# Set required secrets (choose one credential method)
# A) Base64 service account JSON
flyctl secrets set FIREBASE_SERVICE_ACCOUNT=BASE64_JSON_HERE

# or B) GOOGLE_APPLICATION_CREDENTIALS alternative not recommended in container
# prefer A for simplicity

# API key to protect the endpoint
flyctl secrets set NOTIFY_API_KEY=YOUR_LONG_RANDOM_KEY

# App port
flyctl secrets set PORT=8080

# Deploy using the Dockerfile at repo root
flyctl deploy

# App URL
aaa=`flyctl info --json | jq -r .Hostname`
```

Your server will listen on `:8080` in the container and be reachable via the Fly hostname.

### Sending a notification

Token send:
```powershell
$body = @{
  token = "DEVICE_OR_WEB_PUSH_TOKEN"
  title = "CTraX"
  body  = "Hello from CTraX"
  data  = @{ type = "test" }
} | ConvertTo-Json

Invoke-RestMethod -Method POST `
  -Uri https://YOUR_FLY_HOSTNAME/api/notify `
  -Headers @{ "Content-Type" = "application/json"; "x-api-key" = "YOUR_LONG_RANDOM_KEY" } `
  -Body $body
```

Topic send (subscriber must subscribe to topic):
```powershell
$body = @{ topic = "bus-42"; title = "Bus 42"; body = "Arriving in 5 minutes" } | ConvertTo-Json
Invoke-RestMethod -Method POST `
  -Uri https://YOUR_FLY_HOSTNAME/api/notify `
  -Headers @{ "Content-Type" = "application/json"; "x-api-key" = "YOUR_LONG_RANDOM_KEY" } `
  -Body $body
```

### Notes
- Keep `server/.env` for local development only; in Fly use `flyctl secrets`.
- Don’t commit service account JSON or secrets. `.gitignore` already excludes common patterns.
- If you only use Netlify for static site, it’s normal for server to return 404 for static paths; the API endpoints `/api/notify` and `/health` remain available.
