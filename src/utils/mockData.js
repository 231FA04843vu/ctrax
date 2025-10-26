
// Coordinates sourced from OpenStreetMap (Nominatim) where available; a couple are approximate within Guntur region.
// Default mock values used to seed Firebase and as immediate fallbacks.
const mockData = {
  bus: {
    id: 'BUS-7016',
    name: 'sattenapalli bus',
    route: 'vignan university — sattenapalli',
    // Start near Vignan Group of Institutions (Vadlamudi/Chebrolu area)
    position: [16.2315471, 80.5526116],
    // Rough ETA to destination assuming ~35km/h average
    eta: '≈81 mins',
    driverName: 'sankar rao',
    driverPhone: '+91 98765 43210',
    speedKmph: 32,
    startPlace: 'Vignan University',
    // planned start time (HH:mm) in IST for schedule comparison/display
    startTime: '16:30',
    // whether driver is sharing; controls visibility on student side
    sharing: false
  },
  stops: [
    // Chuttugunta (central Guntur junction) — approximate city-center coords
    { name: 'chuttugunta', position: [16.3067, 80.4365], eta: '26 mins', plannedOffsetMins: 26 },
    // Verified via OSM Nominatim
    { name: 'perecherla', position: [16.3323613, 80.3527921], eta: '42 mins', plannedOffsetMins: 42 },
    { name: 'medikonduru', position: [16.346464, 80.3002], eta: '52 mins', plannedOffsetMins: 52 },
    // Verified via OSM Nominatim (village)
    { name: 'jangamguntla palem', position: [16.3616057, 80.2697529], eta: '58 mins', plannedOffsetMins: 58 },
    // Approximate point between Jangamguntla Palem and Sattenapalle
    { name: 'bhiminenivaripalem', position: [16.3695, 80.237], eta: '64 mins', plannedOffsetMins: 64 },
    // Town center of Sattenapalle (OSM Nominatim)
    { name: 'sattenapalli', position: [16.3925393, 80.1489341], eta: '81 mins', plannedOffsetMins: 81 }
  ]
}

export default mockData
 
// --- Firebase realtime wiring (seed + live mirror) ---
// We mirror mockData under the path mockData/{bus,stops} in Firebase Realtime Database.
// On first run (when the DB path is empty), we seed with these defaults.

import { db } from './firebase'
import { ref, get, set, onValue } from 'firebase/database'

const BUS_PATH = 'mockData/bus'
const STOPS_PATH = 'mockData/stops'

async function seedIfEmpty(){
  try {
    const [busSnap, stopsSnap] = await Promise.all([
      get(ref(db, BUS_PATH)),
      get(ref(db, STOPS_PATH))
    ])
    const needBus = !busSnap.exists()
    const needStops = !stopsSnap.exists()
    if (needBus) await set(ref(db, BUS_PATH), mockData.bus)
    if (needStops) await set(ref(db, STOPS_PATH), mockData.stops)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('MockData seed skipped:', e?.message)
  }
}

// Kick off seeding lazily; safe to run in browser
seedIfEmpty()

// Attach realtime listeners to keep the in-memory object up to date
try {
  onValue(ref(db, BUS_PATH), (snap) => {
    const val = snap.val()
    if (val && typeof val === 'object') {
      Object.assign(mockData.bus, val)
    }
  })
  onValue(ref(db, STOPS_PATH), (snap) => {
    const arr = snap.val()
    if (Array.isArray(arr)) {
      mockData.stops = arr
    }
  })
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('MockData realtime binding skipped:', e?.message)
}
