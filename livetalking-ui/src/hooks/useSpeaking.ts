/**
 * Speaking 状态管理 Hook — 统一轮询逻辑
 */
import { useState, useRef, useCallback } from 'react';
import { sessionApi } from '../services/api';

export function useSpeaking(sessionId: string) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setIsSpeaking(true);
    pollRef.current = setInterval(async () => {
      try {
        const d = await sessionApi.isSpeaking(sessionId);
        if (!d.data) {
          setIsSpeaking(false);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch {
        setIsSpeaking(false);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 1000);
  }, [sessionId]);

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  return { isSpeaking, startPolling, stopSpeaking };
}
