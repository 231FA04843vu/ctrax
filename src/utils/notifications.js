// Client helper: subscribe/unsubscribe a token to a topic via the Netlify function
export async function subscribeToTopic(token, topic) {
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'subscribe', token, topic }),
  })
  return res.json()
}

export async function unsubscribeFromTopic(token, topic) {
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unsubscribe', token, topic }),
  })
  return res.json()
}

export async function sendNotificationToTopic(topic, title, bodyText, data) {
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, title, body: bodyText, data }),
  })
  return res.json()
}
