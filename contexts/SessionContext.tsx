'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateSessionId, storeSessionId } from '@/lib/session';

interface SessionContextType {
  sessionId: string;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    // Always generate a new session ID on component mount (page load/reload)
    const newId = generateSessionId();
    storeSessionId(newId);
    setSessionId(newId);
    console.log('New session created on page load:', newId);
  }, []);

  const resetSession = () => {
    // Simply reload the page - new session will be created automatically
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