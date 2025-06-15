'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getOrCreateSessionId, clearSessionId, generateSessionId, storeSessionId } from '@/lib/session';

interface SessionContextType {
  sessionId: string;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
  }, []);

  const resetSession = () => {
    // Clear existing session first
    sessionStorage.removeItem('sessionId');
    // Generate new session ID
    const newId = generateSessionId();
    sessionStorage.setItem('sessionId', newId);
    console.log('New session ID:', newId);
    // Update state and reload to refresh all components
    setSessionId(newId);
    window.location.reload();
  };

  if (!sessionId) {
    return null; // or loading state
  }

  return (
    <SessionContext.Provider value={{ sessionId, resetSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}