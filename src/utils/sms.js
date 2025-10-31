// Lightweight helpers to open the device's SMS/WhatsApp apps with a prefilled message.
// This avoids paid SMS gateways and works at no service cost (user's carrier/WhatsApp handles sending).

function normalizePhoneForWa(raw){
  // WhatsApp expects an international number without '+'
  const digits = String(raw || '').replace(/\D/g, '')
  // If it's a 10-digit Indian number, prefix 91
  if (digits.length === 10) return '91' + digits
  // Otherwise return as-is (assuming it already contains country code)
  return digits
}

export function buildSmsLink(phone, message){
  const p = encodeURIComponent(String(phone || ''))
  const body = encodeURIComponent(String(message || ''))
  // Use ?body= which works on most modern Android/iOS
  return `sms:${p}?body=${body}`
}

export function buildWhatsappLink(phone, message){
  const num = normalizePhoneForWa(phone)
  const text = encodeURIComponent(String(message || ''))
  return `https://wa.me/${num}?text=${text}`
}

export default {
  buildSmsLink,
  buildWhatsappLink,
}
