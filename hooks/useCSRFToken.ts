'use client';

import { useEffect, useState } from 'react';

/**
 * React hook untuk fetch dan manage CSRF token
 * 
 * Usage dalam component:
 * const csrfToken = useCSRFToken();
 * 
 * Include dalam fetch requests:
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'x-csrf-token': csrfToken || ''
 *   },
 *   body: JSON.stringify(data)
 * })
 */
export function useCSRFToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        setLoading(true);
        const response = await fetch('/api/csrf-token');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch CSRF token: ${response.status}`);
        }
        
        const { token } = await response.json();
        setToken(token);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching CSRF token:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchToken();
  }, []);

  return token;
}

/**
 * Helper untuk make authenticated API calls dengan CSRF protection
 * 
 * Usage:
 * const makeSecureRequest = useSecureAPI();
 * const result = await makeSecureRequest('/api/endpoint', {
 *   method: 'POST',
 *   body: { data: '...' }
 * });
 */
export function useSecureAPI() {
  const csrfToken = useCSRFToken();

  return async (
    url: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ) => {
    if (!csrfToken) {
      throw new Error('CSRF token not loaded');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      ...options.headers,
    };

    const config: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `API Error: ${response.status}`);
      (error as any).code = errorData.code;
      (error as any).status = response.status;
      throw error;
    }

    return response.json();
  };
}
