import { db } from './firebase'
import { ref, onValue, update, get, set } from 'firebase/database'

const PATH = 'appConfig'

const defaults = {
  version: 'v1.0.0',
  size: '~12 MB',
  directUrl: 'https://www.upload-apk.com/en/T1VCNGKtl3b4MYy',
}

export function onAppConfig(callback){
  const r = ref(db, PATH)
  return onValue(r, (snap) => {
    const val = snap.val() || {}
    const cfg = { ...defaults, ...val }
    try { callback(cfg) } catch {}
  })
}

export async function getAppConfig(){
  const r = ref(db, PATH)
  const snap = await get(r)
  const val = snap.val() || {}
  return { ...defaults, ...val }
}

export async function setAppConfig(patch){
  const r = ref(db, PATH)
  // ensure node exists before update
  try {
    const snap = await get(r)
    if (!snap.exists()) await set(r, defaults)
  } catch {}
  await update(r, patch)
  return true
}

export default { onAppConfig, getAppConfig, setAppConfig }
