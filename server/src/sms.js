/**
 * SMS Service for JC Tech Zone
 * Uses TextBee.dev (Android Gateway) or Mock mode for local dev.
 */

function sanitizeNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  return digits;
}

function printMockBox(to, message, note) {
  console.log('\n================== 📱 [SMS DISPATCH] ==================');
  console.log(`To:      ${to}`);
  console.log(`Message: ${message}`);
  if (note) console.log(`Note:    ${note}`);
  console.log(`Time:    ${new Date().toLocaleTimeString()}`);
  console.log('========================================================\n');
}

export async function sendSMS(to, message) {
  const provider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
  const cleanTo = sanitizeNumber(to);

  if (!cleanTo || cleanTo.length < 10) {
    console.warn(`[SMS] Skipped: invalid phone number "${to}"`);
    return { success: false, reason: 'invalid_number' };
  }

  // 1. MOCK MODE (Zero cost, console output only)
  if (provider === 'mock') {
    printMockBox(cleanTo, message, 'Dev/Mock Mode (SMS_PROVIDER=mock)');
    return { success: true, mode: 'mock' };
  }

  // 2. TEXTBEE.DEV GATEWAY (Sends real SMS via Android phone)
  if (provider === 'textbee') {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;

    if (!apiKey || !deviceId) {
      console.warn('[SMS] TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID missing. Falling back to console.');
      printMockBox(cleanTo, message, 'Fallback: missing TextBee credentials');
      return { success: false, reason: 'missing_credentials' };
    }

    try {
      const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/sendSMS`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [cleanTo],
          message: message,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.warn(`[SMS] TextBee error (${res.status}):`, data);
        printMockBox(cleanTo, message, `TextBee Error (${res.status})`);
        return { success: false, status: res.status, error: data };
      }

      console.log(`[SMS] Queued via TextBee for ${cleanTo}:`, data?.data?.message || 'Queued');
      return { success: true, data };
    } catch (err) {
      console.error('[SMS] Network failure calling TextBee:', err.message);
      printMockBox(cleanTo, message, `Network failure (${err.message})`);
      return { success: false, error: err.message };
    }
  }

  return { success: false, reason: 'unknown_provider' };
}
