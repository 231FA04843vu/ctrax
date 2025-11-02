import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = process.env.PORT || 3000

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

const server = http.createServer((req, res) => {
  try {
    const reqUrl = decodeURI(req.url || '/')

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
