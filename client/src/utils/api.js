// API utility wrapper
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Include httpOnly cookies for admin auth
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
