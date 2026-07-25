#!/usr/bin/env node
/*
  scripts/clean_sim.js

  Safely remove legacy simulation data from Firebase Realtime Database under `buses/{id}/sim`.
  Usage:
    node scripts/clean_sim.js --dry-run            # show what would be removed
    node scripts/clean_sim.js --remove-sim         # actually remove `sim` nodes
    node scripts/clean_sim.js --remove-sim --reset-speed # remove sim and clear speedKmph

  Environment:
    Provide `FIREBASE_SERVICE_ACCOUNT` (base64 JSON) or `FIREBASE_SERVICE_ACCOUNT_PATH`

  This script is safe to run locally by an admin. It will iterate over all buses and
  remove the `sim` child. With `--reset-speed` it will also set `speedKmph` to null so
  the UI falls back to driver-reported GPS speeds.
*/

import fs from 'fs'
import path from 'path'
import process from 'process'
import { createRequire } from 'module'

function usage(){
  console.log('Usage: node scripts/clean_sim.js [--dry-run] [--remove-sim] [--reset-speed]')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const doRemove = args.includes('--remove-sim')
const resetSpeed = args.includes('--reset-speed')
if (!dryRun && !doRemove && !resetSpeed) {
  console.log('No operation specified. Defaulting to --dry-run to be safe.')
}

async function initAdmin(){
  try {
    const mod = await import('firebase-admin')
    const admin = mod?.default || mod
    const hasApp = Array.isArray(admin.apps) && admin.apps.length > 0
    if (!hasApp) {
      const svcBase64 = process.env.FIREBASE_SERVICE_ACCOUNT
      const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      if (svcBase64) {
        const json = JSON.parse(Buffer.from(svcBase64, 'base64').toString('utf-8'))
        admin.initializeApp({ credential: admin.credential.cert(json), databaseURL: process.env.FIREBASE_DATABASE_URL })
      } else if (svcPath && fs.existsSync(path.resolve(svcPath))) {
        const raw = fs.readFileSync(path.resolve(svcPath), 'utf-8')
        const json = JSON.parse(raw)
        admin.initializeApp({ credential: admin.credential.cert(json), databaseURL: process.env.FIREBASE_DATABASE_URL })
      } else {
        admin.initializeApp({ databaseURL: process.env.FIREBASE_DATABASE_URL })
      }
    }
    return admin
  } catch (e) {
    console.error('Failed to initialize firebase-admin:', e?.message || e)
    process.exit(2)
  }
}

async function main(){
  const admin = await initAdmin()
  const db = admin.database()
  const ref = db.ref('buses')
  console.log('Fetching buses from Realtime Database...')
  const snap = await ref.once('value')
  const buses = snap.val() || {}
  const ids = Object.keys(buses)
  console.log(`Found ${ids.length} buses`)
  let changes = 0
  for (const id of ids){
    const node = buses[id] || {}
    const hasSim = node.hasOwnProperty('sim')
    const hasSpeed = node.hasOwnProperty('speedKmph')
    if (!hasSim && !(resetSpeed && hasSpeed)) continue
    console.log(`- ${id}: sim=${hasSim} speedKmph=${hasSpeed ? node.speedKmph : 'n/a'}`)
    if (!dryRun && doRemove && hasSim) {
      try {
        await ref.child(id).child('sim').remove()
        console.log(`  -> removed buses/${id}/sim`)
        changes++
      } catch (e) { console.error('  ERROR removing sim for', id, e) }
    }
    if (!dryRun && resetSpeed && hasSpeed) {
      try {
        await ref.child(id).update({ speedKmph: null })
        console.log(`  -> set buses/${id}/speedKmph = null`)
        changes++
      } catch (e) { console.error('  ERROR resetting speed for', id, e) }
    }
  }
  console.log('\nDone. Changes made:', changes)
  if (dryRun) console.log('Dry-run mode: no changes were applied. Rerun with --remove-sim to apply changes.')
  process.exit(0)
}

main().catch(e => { console.error('Script failed:', e); process.exit(3) })
