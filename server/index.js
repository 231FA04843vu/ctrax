import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fileURLToPath as furl } from 'url'
import { createRequire } from 'module'
import dotenv from 'dotenv'

// Firebase Admin (optional: only initialized if credentials are present)
let admin = null
try {
  // defer import to allow running without the dependency during build
  const require = createRequire(import.meta.url)
  admin = await import('firebase-admin')
} catch (e) {
  // firebase-admin not installed; notification API will be disabled
  admin = null
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Load env from project root .env, then server/.env (if present)
dotenv.config()
dotenv.config({ path: path.join(__dirname, '.env') })
const PORT = process.env.PORT || 3000
const NOTIFY_API_KEY = process.env.NOTIFY_API_KEY || ''

const distDir = path.join(__dirname, '..', 'dist')
const publicDir = path.join(__dirname, '..', 'public')

function findFile(relPaths) {
  for (const p of relPaths) {
    if (!p) continue
    if (fs.existsSync(p)) return p
  }
  return null
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'application/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.png': return 'image/png'
    case '.jpg': case '.jpeg': return 'image/jpeg'
    case '.svg': return 'image/svg+xml'
    case '.apk': return 'application/vnd.android.package-archive'
    default: return 'application/octet-stream'
  }
}

// Attempt to initialize Firebase Admin using env credentials
let messaging = null
if (admin) {
  try {
    const hasApp = admin.getApps().length > 0
    if (!hasApp) {
      // Support either base64-encoded JSON in FIREBASE_SERVICE_ACCOUNT
      // or a file path in FIREBASE_SERVICE_ACCOUNT_PATH, or ADC
      const svcBase64 = process.env.FIREBASE_SERVICE_ACCOUNT
      const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      if (svcBase64) {
        const json = JSON.parse(Buffer.from(svcBase64, 'base64').toString('utf-8'))
        admin.initializeApp({ credential: admin.cert(json) })
      } else if (svcPath && fs.existsSync(svcPath)) {
        const json = JSON.parse(fs.readFileSync(svcPath, 'utf-8'))
        admin.initializeApp({ credential: admin.cert(json) })
      } else {
        // Try default credentials if running on GCP or with GOOGLE_APPLICATION_CREDENTIALS
        admin.initializeApp({})
      }
    }
    messaging = admin.getMessaging()
  } catch (e) {
    console.warn('Firebase Admin not initialized, notification API disabled:', e?.message || e)
  }
}

function json(res, code, obj){
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

function parseBody(req){
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = decodeURI(req.url || '/')

    // Simple health endpoint
    if (reqUrl === '/health') {
      json(res, 200, { ok: true })
      return
    }

    // Notifications API (free via FCM): POST /api/notify
    if (reqUrl === '/api/notify') {
      if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return }
      if (!messaging) { json(res, 503, { error: 'Notifications not configured on server' }); return }
      if (NOTIFY_API_KEY) {
        const k = req.headers['x-api-key'] || ''
        if (k !== NOTIFY_API_KEY) { json(res, 401, { error: 'Unauthorized' }); return }
      } else {
        // If no API key set, only allow a restricted demo topic to avoid abuse
        // This means you can still test locally without exposing open send-to-anyone.
      }
      let body
      try { body = await parseBody(req) } catch { json(res, 400, { error: 'Invalid JSON' }); return }
      const { token, topic, title, body: text, data } = body || {}
      if (!token && !topic) { json(res, 400, { error: 'Provide token or topic' }); return }
      const msg = {
        notification: title || text ? { title: title || 'CTraX', body: text || '' } : undefined,
        data: data || undefined,
      }
      if (token) msg.token = token
      if (topic) msg.topic = topic
      try {
        const resp = await messaging.send(msg)
        json(res, 200, { id: resp })
      } catch (e) {
        json(res, 500, { error: e?.message || String(e) })
      }
      return
    }

    // Force-download endpoint for APK
    if (reqUrl === '/download/ctrax-latest.apk' || reqUrl.endsWith('/ctrax-latest.apk')) {
      const candidates = [
        path.join(distDir, 'assets', 'ctrax-latest.apk'),
        path.join(publicDir, 'assets', 'ctrax-latest.apk'),
        path.join(publicDir, 'download', 'ctrax-latest.apk')
      ]
      const apk = findFile(candidates)
      if (!apk) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('CTraX APK not found on server')
        return
      }
      const stat = fs.statSync(apk)
      res.writeHead(200, {
        'Content-Type': contentTypeFor(apk),
        'Content-Length': String(stat.size),
        'Content-Disposition': 'attachment; filename="ctrax-latest.apk"'
      })
      const stream = fs.createReadStream(apk)
      stream.pipe(res)
      return
    }

    // Serve static files from dist then public
    const tryStatic = (urlPath) => {
      const urlPathNormalized = urlPath.split('?')[0]
      const candidatePaths = [
        path.join(distDir, urlPathNormalized),
        path.join(publicDir, urlPathNormalized)
      ]
      return findFile(candidatePaths)
    }

    let filePath = tryStatic(reqUrl)
    if (filePath) {
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        const indexInDir = findFile([path.join(filePath, 'index.html')])
        if (indexInDir) filePath = indexInDir
        else {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Forbidden')
          return
        }
      }
      res.writeHead(200, { 'Content-Type': contentTypeFor(filePath), 'Content-Length': String(fs.statSync(filePath).size) })
      fs.createReadStream(filePath).pipe(res)
      return
    }

    // Fallback to index.html for SPA
    const indexInDist = path.join(distDir, 'index.html')
    const indexInPublic = path.join(publicDir, 'index.html')
    const indexFile = findFile([indexInDist, indexInPublic])
    if (indexFile) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      fs.createReadStream(indexFile).pipe(res)
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  } catch (err) {
    console.error('Server error', err)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal server error')
  }
})

server.listen(PORT, () => {
  console.log(`CTraX static server listening on http://localhost:${PORT}`)
})
