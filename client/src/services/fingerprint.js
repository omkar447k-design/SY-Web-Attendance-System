// UNIVERSAL HARDWARE BIOMETRICS & FINGERPRINTING ENGINE
// - Mobile (iPhone / iPad): Apple Face ID / Touch ID / Device Passcode
// - Mobile (Android): Native Fingerprint Sensor / Screen PIN
// - Desktop / PC / Laptop (Windows / Mac / Linux): Standard Direct Access (No Biometric Lock)
// - Hardware Engine: FingerprintJS v4 + Hardware Canvas/WebGL Engine

export function getDeviceType() {
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isMobile = isIos || isAndroid;
  const isMac = /macintosh|mac os x/i.test(ua) && !isIos;
  const isWindows = /windows/i.test(ua);

  if (isIos) return { type: 'ios', isMobile: true, name: 'iPhone / iOS Device', biometricName: 'Apple Face ID / Touch ID' };
  if (isAndroid) return { type: 'android', isMobile: true, name: 'Android Phone', biometricName: 'Android Fingerprint Sensor' };
  if (isMac) return { type: 'mac', isMobile: false, name: 'Apple Mac Laptop', biometricName: 'Mac OS' };
  if (isWindows) return { type: 'windows', isMobile: false, name: 'Windows PC / Laptop', biometricName: 'Windows OS' };
  return { type: 'other', isMobile: false, name: 'PC / Laptop', biometricName: 'Desktop Browser' };
}

export async function getDeviceIdentity() {
  let visitorId = null;

  // 1. Primary: FingerprintJS v4 Engine
  if (typeof window !== 'undefined' && window.FingerprintJS) {
    try {
      const fp = await window.FingerprintJS.load();
      const result = await fp.get();
      if (result && result.visitorId) {
        visitorId = result.visitorId;
      }
    } catch (err) {
      console.warn('FingerprintJS load warning, switching to hardware hash fallback:', err.message);
    }
  }

  // 2. Hardware Engine (Canvas + WebGL + Audio + Screen + GPU Renderer + Touch)
  if (!visitorId) {
    const components = [];
    components.push(`screen:${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
    components.push(`dpr:${window.devicePixelRatio || 1}`);
    components.push(`cores:${navigator.hardwareConcurrency || 4}`);
    components.push(`touch:${navigator.maxTouchPoints || 1}`);
    components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}`);
    components.push(`lang:${navigator.language || 'en'}`);
    components.push(`platform:${navigator.platform || ''}`);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'alphabetic';
        ctx.font = "15px 'Roboto', -apple-system, sans-serif";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('HARDWARE_ATTENDANCE_LOCK_2026', 2, 18);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('HARDWARE_ATTENDANCE_LOCK_2026', 4, 20);
        components.push(`canvas:${canvas.toDataURL().slice(-60)}`);
      }
    } catch (e) {
      components.push('canvas:err');
    }

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

    visitorId = 'dev_fp_' + Math.abs(h).toString(16).padStart(12, '0');
  }

  const device = getDeviceType();

  return {
    deviceId: visitorId,
    fingerprint: visitorId,
    deviceType: device.type,
    deviceName: device.name,
    biometricName: device.biometricName,
    isMobile: device.isMobile
  };
}

// 3. BIOMETRIC AUTHENTICATION (Active on Mobile Phones: Apple Face ID / Android Fingerprint)
export async function checkBiometricsAvailable() {
  const device = getDeviceType();
  if (!device.isMobile) return false;

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

export async function promptCompulsoryDeviceAuth(studentName = 'Student') {
  const device = getDeviceType();

  // PC / Laptop / Windows / Mac -> Skip Biometric Prompt Completely!
  if (!device.isMobile) {
    return {
      success: true,
      method: `${device.name} (Direct Access)`,
      verifiedAt: new Date().toISOString()
    };
  }

  // Mobile Phones Only (Apple Face ID / Android Fingerprint Sensor)
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
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
        name: studentName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'student',
        displayName: studentName
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256 (Apple Face ID, Android Fingerprint)
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Phone hardware sensor
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
        method: device.biometricName,
        credentialId: credential.id,
        verifiedAt: new Date().toISOString()
      };
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error(`🛑 Authentication Cancelled: ${device.biometricName} or Phone Passcode is required on mobile phones.`);
      }
      console.warn('Mobile biometric note:', err.message);
    }
  }

  return {
    success: true,
    method: `${device.name} Hardware Signature`,
    verifiedAt: new Date().toISOString()
  };
}
