import { getAuth } from 'firebase/auth';

/**
 * Helper function untuk make authenticated API calls
 * Automatically adds Firebase ID token to Authorization header
 * 
 * Usage:
 * const result = await authenticatedFetch('/api/generate-tp', {
 *   method: 'POST',
 *   body: { textContent: '...', grade: '10', ... }
 * });
 */
export async function authenticatedFetch<T = any>(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get Firebase ID token
  const token = await user.getIdToken();

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  // Prepare request
  const config: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  // Make request
  const response = await fetch(url, config);

  // Handle error responses
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    const error = new Error(errorData.error || `API Error: ${response.status}`);
    (error as any).code = errorData.code;
    (error as any).status = response.status;
    (error as any).data = errorData;
    
    throw error;
  }

  // Parse and return response
  return response.json();
}

/**
 * Refresh token if needed (called automatically when token expires)
 */
export async function refreshAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.getIdToken(true); // Force refresh
}
