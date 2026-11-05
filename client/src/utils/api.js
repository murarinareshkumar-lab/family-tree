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
    const errorMsg = (data && data.error) ? data.error : (typeof data === 'string' ? data : 'Request failed');
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}
