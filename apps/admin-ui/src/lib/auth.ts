export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearAuth();
    return null;
  }
}

export function setAuth(data: AuthUser & { accessToken: string; refreshToken?: string }) {
  localStorage.setItem('token', data.accessToken);
  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
  }
  localStorage.setItem(
    'user',
    JSON.stringify({
      userId: data.userId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      role: data.role,
    }),
  );
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}
