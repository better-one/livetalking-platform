/**
 * WebRTC 连接 Hook — 消除 App.tsx / CelebrityPage 的重复连接代码
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';

interface WebRTCState {
  isConnected: boolean;
  isPlaying: boolean;
  sessionId: string;
  fps: number;
}

export function useWebRTC() {
  const [state, setState] = useState<WebRTCState>({
    isConnected: false, isPlaying: false, sessionId: '', fps: 0,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const connect = useCallback(async (avatarId?: string) => {
    try {
      // Close existing connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      const pc = new RTCPeerConnection({});
      pcRef.current = pc;

      pc.addEventListener('track', (evt) => {
        if (evt.track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = evt.streams[0];
        } else if (evt.track.kind === 'audio' && audioRef.current) {
          audioRef.current.srcObject = evt.streams[0];
        }
      });

      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') {
          setState(s => ({ ...s, isConnected: true, isPlaying: true }));
          message.success('WebRTC 连接成功 Connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setState(s => ({ ...s, isConnected: false, isPlaying: false }));
        }
      });

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
      });

      const body: any = { sdp: pc.localDescription!.sdp, type: pc.localDescription!.type };
      if (avatarId) body.avatar = avatarId;

      const response = await fetch('/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const answer = await response.json();
      setState(s => ({ ...s, sessionId: answer.sessionid }));
      await pc.setRemoteDescription(answer);
    } catch (e: any) {
      message.error(`连接失败 Failed: ${e.message}`);
    }
  }, []);

  const disconnect = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    setState({ isConnected: false, isPlaying: false, sessionId: '', fps: 0 });
    message.info('已断开 Disconnected');
  }, []);

  // FPS counter
  useEffect(() => {
    if (!state.isPlaying) return;
    let count = 0, last = performance.now(), running = true;
    const tick = () => {
      if (!running) return;
      count++;
      const now = performance.now();
      if (now - last >= 1000) {
        setState(s => ({ ...s, fps: count }));
        count = 0;
        last = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [state.isPlaying]);

  return { ...state, connect, disconnect, videoRef, audioRef };
}
