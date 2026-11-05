// API utility wrapper
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

  const response = await fetch(url, {
    ...options,
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
