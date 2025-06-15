export function generateSessionId(): string {
  const timestamp = Date.now();
  const randomPart = crypto.randomUUID().slice(0, 8);
  return `${timestamp}-${randomPart}`;
}

export function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('sessionId');
}

export function storeSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('sessionId', sessionId);
}

export function clearSessionId(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('sessionId');
}

export function getOrCreateSessionId(): string {
  let sessionId = getStoredSessionId();
  if (!sessionId) {
    sessionId = generateSessionId();
    storeSessionId(sessionId);
  }
  return sessionId;
}