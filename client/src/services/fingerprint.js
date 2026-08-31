// ANDROID HARDWARE FINGERPRINTING & BIOMETRICS ENGINE
// 1. Hardware Fingerprinting: Computes unique visitor ID from Android Canvas, GPU, Screen, Cores, and Touch sensors.
// 2. Physical Android Fingerprint Sensor (WebAuthn): Invokes native Android biometric sensor for thumbprint authentication.

export async function getDeviceIdentity() {
  let visitorId = null;

  // 1. Primary: FingerprintJS v4 Open-Source Browser Engine
  if (typeof window !== 'undefined' && window.FingerprintJS) {
    try {
      const fp = await window.FingerprintJS.load();
      const result = await fp.get();
      if (result && result.visitorId) {
        visitorId = result.visitorId;
      }
    } catch (err) {
      console.warn('FingerprintJS load warning, switching to Android hardware fallback:', err.message);
    }
  }

  // 2. Android Deep Hardware Fallback Engine
  if (!visitorId) {
    const components = [];

    // Android Screen & Display
    components.push(`screen:${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
    components.push(`dpr:${window.devicePixelRatio || 1}`);
    components.push(`cores:${navigator.hardwareConcurrency || 4}`);
    components.push(`touch:${navigator.maxTouchPoints || 1}`);
    components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}`);
    components.push(`lang:${navigator.language || 'en'}`);
    components.push(`platform:${navigator.platform || 'Android'}`);

    // Android Canvas Fingerprinting
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'alphabetic';
        ctx.font = "15px 'Roboto', 'Arial', sans-serif";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('ANDROID_ATTENDANCE_LOCK_2026', 2, 18);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('ANDROID_ATTENDANCE_LOCK_2026', 4, 20);
        components.push(`canvas:${canvas.toDataURL().slice(-60)}`);
      }
    } catch (e) {
      components.push('canvas:err');
    }

    // Android WebGL GPU Renderer (Adreno / Mali)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          components.push(`gpu_v:${gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}`);
          components.push(`gpu_r:${gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`);
        }
      }
    } catch (e) {
      components.push('webgl:err');
    }

    // Cryptographic Avalanche Hash
    const raw = components.join('|||');
    let h = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h, 5) + 0xe6546b64;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;

    visitorId = 'and_fp_' + Math.abs(h).toString(16).padStart(12, '0');
  }

  return {
    deviceId: visitorId,
    fingerprint: visitorId,
    isAndroid: /android/i.test(navigator.userAgent || '')
  };
}

// 3. Android Biometric Fingerprint Sensor (WebAuthn API)
export async function checkBiometricsAvailable() {
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return Boolean(available);
    } catch (e) {
      return false;
    }
  }
  return false;
}

export async function promptAndroidBiometricFingerprint(studentName = 'Student') {
  if (!window.PublicKeyCredential) {
    throw new Error('Biometric hardware sensor is not available on this browser.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'College Attendance Portal',
      id: window.location.hostname || 'localhost'
    },
    user: {
      id: userId,
      name: studentName.toLowerCase().replace(/\s+/g, '_'),
      displayName: studentName
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256
      { alg: -257, type: 'public-key' } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Android phone fingerprint/screen biometric
      userVerification: 'required'
    },
    timeout: 60000,
    attestation: 'none'
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    return {
      success: true,
      credentialId: credential.id,
      verifiedAt: new Date().toISOString()
    };
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric verification cancelled or fingerprint mismatch.');
    }
    throw new Error(err.message || 'Android biometric verification failed.');
  }
}
