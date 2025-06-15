'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateSessionId, storeSessionId } from '@/lib/session';
import { list, remove } from 'aws-amplify/storage';
import { toast } from 'sonner';

interface SessionContextType {
  sessionId: string;
  resetSession: () => void;
  isResetting: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);

  const cleanupSessionFiles = useCallback(async (sessionId: string, silent = false) => {
    try {
      console.log(`Cleaning up files for session: ${sessionId}`);
      
      // List all files in the session directory
      const sessionPrefix = `sessions/${sessionId}/`;
      const result = await list({
        path: sessionPrefix,
        options: {
          listAll: true
        }
      });

      console.log(`Found ${result.items.length} files to delete`);

      // Delete all files in parallel
      const deletePromises = result.items
        .filter(item => item.path && !item.path.endsWith('/')) // Filter out folder entries
        .map(async (item) => {
          try {
            await remove({ path: item.path });
            console.log(`Deleted: ${item.path}`);
          } catch (error) {
            console.error(`Failed to delete ${item.path}:`, error);
          }
        });

      await Promise.all(deletePromises);
      console.log('Session cleanup completed');
      
      if (!silent) {
        toast.success('セッションファイルを削除しました');
      }
      
    } catch (error) {
      console.error('Session cleanup failed:', error);
      if (!silent) {
        toast.error('ファイル削除中にエラーが発生しました');
      }
    }
  }, []);

  useEffect(() => {
    // Always generate a new session ID on component mount (page load/reload)
    const newId = generateSessionId();
    storeSessionId(newId);
    setSessionId(newId);
    console.log('New session created on page load:', newId);
  }, []); // Only run once on mount

  const resetSession = async () => {
    if (isResetting) return;
    
    setIsResetting(true);
    
    try {
      // Clean up current session files
      await cleanupSessionFiles(sessionId);
      
      // Reload the page to create new session
      window.location.reload();
    } catch (error) {
      console.error('Session reset failed:', error);
      setIsResetting(false);
      toast.error('セッションリセットに失敗しました');
    }
  };

  if (!sessionId) {
    return null; // or loading state
  }

  return (
    <SessionContext.Provider value={{ 
      sessionId, 
      resetSession, 
      isResetting
    }}>
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