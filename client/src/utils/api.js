// API utility wrapper with AES-256-GCM in-transit payload encryption

const PII_SECRET = 'family-tree-portal-gcm256-pii-default-master-key';

/**
 * Encrypts an object in-transit using standard browser Web Crypto AES-256-GCM.
 * Compatible with backend decryptPii format: enc:gcm:v1:<iv>:<tag>:<ciphertext>
 */
async function encryptPayloadInTransit(dataObj) {
  try {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      return null;
    }
    const jsonStr = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
    const enc = new TextEncoder();
    const keyHash = await window.crypto.subtle.digest('SHA-256', enc.encode(PII_SECRET));
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyHash,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      enc.encode(jsonStr)
    );
    const cipherBytes = new Uint8Array(cipherBuffer);
    const ciphertext = cipherBytes.slice(0, -16);
    const authTag = cipherBytes.slice(-16);

    const b64 = (buf) => {
      let binary = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    return `enc:gcm:v1:${b64(iv)}:${b64(authTag)}:${b64(ciphertext)}`;
  } catch (err) {
    console.warn('[In-Transit Encryption] Fallback to standard payload:', err?.message);
    return null;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  
  // Check for private admin key in URL or session storage
  const urlParams = new URLSearchParams(window.location.search || window.location.hash.slice(window.location.hash.indexOf('?')));
  const keyFromUrl = urlParams.get('key') || urlParams.get('admin_key');
  if (keyFromUrl) {
    sessionStorage.setItem('ft_admin_key', keyFromUrl);
  }
  const adminKey = sessionStorage.getItem('ft_admin_key');

  const headers = {
    'Content-Type': 'application/json',
    ...(adminKey ? { 'x-admin-key': adminKey } : {}),
    ...(options.headers || {})
  };

  let body = options.body;
  const method = (options.method || 'GET').toUpperCase();

  // In-transit AES-256-GCM payload encryption for mutating requests
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      const encrypted = await encryptPayloadInTransit(parsed);
      if (encrypted) {
        body = JSON.stringify({ encrypted_payload: encrypted });
        headers['x-payload-encrypted'] = 'true';
      }
    } catch (_) {
      // Keep original body
    }
  }

  const response = await fetch(url, {
    ...options,
    body,
    headers,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let errorMsg = (data && data.error) ? data.error : (typeof data === 'string' ? data : 'Request failed');
    // Sanitize technical errors (e.g. Vercel NOT_FOUND, HTML crash pages, function invocation errors)
    if (
      typeof errorMsg === 'string' &&
      (errorMsg.includes('NOT_FOUND') ||
       errorMsg.includes('The page could not be found') ||
       errorMsg.includes('FUNCTION_INVOCATION_FAILED') ||
       errorMsg.includes('<html') ||
       errorMsg.includes('<!DOCTYPE') ||
       response.status === 404 ||
       response.status >= 500)
    ) {
      errorMsg = (data && data.error) ? data.error : 'Service is temporarily unavailable, please try again.';
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}
