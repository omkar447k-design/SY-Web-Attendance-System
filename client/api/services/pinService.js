import crypto from 'crypto';

const PIN_SECRET = process.env.PIN_SECRET || 'sy_dept_pin_secret_key_2026';
const PIN_INTERVAL_MS = 10000;

export class PinService {
  static getPinForSlot(sessionId, slotIndex) {
    const hash = crypto
      .createHmac('sha256', PIN_SECRET)
      .update(`${sessionId}:${slotIndex}`)
      .digest('hex');
    
    const intVal = parseInt(hash.substring(0, 8), 16);
    const pin = 1000 + (intVal % 9000);
    return String(pin);
  }

  static getCurrentPinInfo(sessionId) {
    const now = Date.now();
    const currentSlot = Math.floor(now / PIN_INTERVAL_MS);
    const pin = this.getPinForSlot(sessionId, currentSlot);
    const msIntoCurrentSlot = now % PIN_INTERVAL_MS;
    const msRemaining = PIN_INTERVAL_MS - msIntoCurrentSlot;
    const secondsRemaining = Math.ceil(msRemaining / 1000);

    return {
      pin,
      slot: currentSlot,
      msRemaining,
      secondsRemaining,
      rotationPeriodSeconds: PIN_INTERVAL_MS / 1000
    };
  }

  static validatePin(sessionId, submittedPin) {
    if (!submittedPin || String(submittedPin).trim().length !== 4) {
      return { valid: false, reason: 'Invalid PIN format (Must be 4 digits)' };
    }

    const cleanPin = String(submittedPin).trim();
    const now = Date.now();
    const currentSlot = Math.floor(now / PIN_INTERVAL_MS);

    // Check current slot
    const currentPin = this.getPinForSlot(sessionId, currentSlot);
    if (cleanPin === currentPin) {
      return { valid: true, slot: currentSlot, isCurrent: true };
    }

    // Check previous slot (sliding tolerance window)
    const prevPin = this.getPinForSlot(sessionId, currentSlot - 1);
    if (cleanPin === prevPin) {
      return { valid: true, slot: currentSlot - 1, isCurrent: false, note: 'Accepted within grace window' };
    }

    return { valid: false, reason: 'Incorrect or expired PIN. Please enter the active PIN on screen.' };
  }
}
