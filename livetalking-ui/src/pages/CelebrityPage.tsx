import { useState, useRef, useCallback, useEffect } from 'react';
import { message, Tooltip, Input, Modal, Space, Typography } from 'antd';
import {
  ArrowLeftOutlined, SettingOutlined, PlusOutlined,
  SendOutlined, DeleteOutlined, AudioOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSpeaking } from '../hooks/useSpeaking';
import { useASR } from '../hooks/useASR';
import { celebrityApi, sessionApi } from '../services/api';
import './CelebrityPage.css';

const { Text } = Typography;

interface Celebrity {
  id: string; name: string; nameEn: string; title: string;
  era: string; color: string; avatar_id: string; has_avatar: boolean; greeting: string;
}

interface ChatMsg { role: 'ai' | 'user'; text: string; time: string; isVoice?: boolean; }

export default function CelebrityPage({ onBack }: { onBack: () => void }) {
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [selected, setSelected] = useState<Celebrity | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const rtc = useWebRTC();
  const speaking = useSpeaking(rtc.sessionId);

  const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  // Fetch celebrities
  useEffect(() => {
    celebrityApi.list().then(d => {
      if (d.code === 0) {
        setCelebrities(d.data);
        if (d.data.length > 0) selectCelebrity(d.data[0]);
      }
    }).catch(() => {});
  }, []);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Select celebrity & connect
  const selectCelebrity = useCallback(async (celeb: Celebrity) => {
    setSelected(celeb);
    setMessages([]);
    speaking.stopSpeaking();
    const avatarId = celeb.has_avatar ? celeb.avatar_id : 'teacher';
    await rtc.connect(avatarId);
    if (celeb.greeting) {
      setMessages([{ role: 'ai', text: celeb.greeting, time: now() }]);
    }
  }, [rtc, speaking]);

  // Speak greeting when connected
  useEffect(() => {
    if (rtc.isConnected && rtc.sessionId && selected?.greeting && messages.length === 1) {
      sessionApi.sendText(rtc.sessionId, selected.greeting, 'echo').catch(() => {});
    }
  }, [rtc.isConnected, rtc.sessionId]);

  // Send message
  const sendMessage = useCallback(async (text: string, isVoice = false) => {
    if (!text.trim() || !rtc.sessionId || !selected) return;
    setMessages(prev => [...prev, { role: 'user', text, time: now(), isVoice }]);
    setInputText('');
    speaking.startPolling();

    try {
      const d = await celebrityApi.chat(selected.id, text, rtc.sessionId);
      if (d.code !== 0) {
        // Fallback: echo
        await sessionApi.sendText(rtc.sessionId, `关于"${text}"，这是个好问题。`, 'echo');
      }
      setMessages(prev => [...prev, { role: 'ai', text: '(回答中...)', time: now() }]);
    } catch (e: any) {
      message.error(`发送失败: ${e.message}`);
      speaking.stopSpeaking();
    }
  }, [rtc.sessionId, selected, speaking]);

  // ASR
  const asr = useASR(useCallback((text: string) => sendMessage(text, true), [sendMessage]));

  // Add celebrity
  const handleAdd = async () => {
    if (!newName.trim()) return message.warning('请输入名字');
    const id = newNameEn.toLowerCase().replace(/\s+/g, '_') || newName;
    await celebrityApi.add({ id, name: newName, nameEn: newNameEn, title: newTitle, system_prompt: newPrompt, color: '#722ed1' });
    message.success('已添加');
    setAddVisible(false);
    setNewName(''); setNewNameEn(''); setNewTitle(''); setNewPrompt('');
    const d = await celebrityApi.list();
    if (d.code === 0) setCelebrities(d.data);
  };

  return (
    <div className="celeb-page">
      <div className="celeb-bg" />

      {/* Top bar */}
      <div className="celeb-topbar">
        <div className="celeb-topbar-left">
          <button className="celeb-icon-btn" onClick={onBack}><ArrowLeftOutlined /></button>
          <span className="celeb-topbar-logo">LiveTalking</span>
          <span className="celeb-topbar-sep">·</span>
          <span className="celeb-topbar-title">名人聊天</span>
        </div>
        <div className="celeb-topbar-right">
          <div className={`celeb-fps-tag ${rtc.fps >= 20 ? 'green' : ''}`}>
            <span className="celeb-fps-dot" /> {rtc.fps} FPS
          </div>
          <button className="celeb-icon-btn"><SettingOutlined /></button>
        </div>
      </div>

      {/* Left switcher */}
      <div className="celeb-switcher">
        {celebrities.map(c => (
          <Tooltip title={`${c.name} ${c.nameEn}`} placement="right" key={c.id}>
            <button className={`celeb-sw-btn ${selected?.id === c.id ? 'active' : ''}`}
              style={{ borderColor: selected?.id === c.id ? c.color : 'transparent' }}
              onClick={() => selectCelebrity(c)}>
              <span style={{ color: c.color, fontSize: 18, fontWeight: 700 }}>{c.name[0]}</span>
            </button>
          </Tooltip>
        ))}
        <button className="celeb-sw-btn add" onClick={() => setAddVisible(true)}>
          <PlusOutlined style={{ color: '#ffffff60' }} />
        </button>
      </div>

      {/* Full-screen video */}
      <div className="celeb-video-container">
        <video ref={rtc.videoRef} autoPlay playsInline className="celeb-video" />
        <audio ref={rtc.audioRef} autoPlay />
        {!rtc.isConnected && (
          <div className="celeb-video-placeholder">
            <div style={{ fontSize: 60, marginBottom: 12, opacity: 0.3 }}>🎭</div>
            <Text style={{ color: '#ffffff50' }}>连接中...</Text>
          </div>
        )}
      </div>

      {/* Name card */}
      {selected && (
        <div className="celeb-namecard">
          <div className="celeb-namecard-avatar" style={{ background: `${selected.color}30`, borderColor: `${selected.color}80` }}>
            <span style={{ color: selected.color, fontSize: 20, fontWeight: 700 }}>{selected.name[0]}</span>
          </div>
          <div className="celeb-namecard-info">
            <div className="celeb-namecard-name">{selected.name} {selected.nameEn}</div>
            <div className="celeb-namecard-desc">{selected.title} · {selected.era}</div>
          </div>
          <div className={`celeb-status-tag ${rtc.isConnected ? 'online' : ''}`}>
            <span className="celeb-status-dot" />
            {speaking.isSpeaking ? '说话中...' : rtc.isConnected ? '对话中' : '离线'}
          </div>
        </div>
      )}

      {/* Chat overlay */}
      <div className="celeb-chat-overlay">
        <div className="celeb-chat-header">
          <span>对话</span>
          <button className="celeb-chat-clear" onClick={() => setMessages([])}><DeleteOutlined style={{ fontSize: 12 }} /></button>
        </div>
        <div className="celeb-chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`celeb-msg ${msg.role}`}>
              <div className="celeb-msg-head">
                {msg.role === 'ai' && <span className="celeb-msg-dot" style={{ background: selected?.color }} />}
                <span className="celeb-msg-name">{msg.role === 'ai' ? selected?.name : '你'}</span>
                <span className="celeb-msg-time">{msg.time}</span>
                {msg.role === 'ai' && speaking.isSpeaking && i === messages.length - 1 && (
                  <span className="celeb-msg-typing">· 说话中...</span>
                )}
              </div>
              <div className={`celeb-msg-bubble ${msg.role}`}>
                {msg.text}
                {msg.isVoice && <span className="celeb-msg-voice">🎤</span>}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="celeb-chat-input">
          <input className="celeb-input-field" value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && inputText.trim()) sendMessage(inputText); }}
            placeholder="输入消息..." disabled={!rtc.isConnected} />
          <button className="celeb-send-btn" onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || !rtc.isConnected}><SendOutlined /></button>
        </div>
      </div>

      {/* Mic button */}
      <div className="celeb-bottom">
        <button className={`celeb-mic-btn ${asr.isListening ? 'listening' : ''}`}
          onClick={asr.toggle} disabled={!rtc.isConnected}>
          {asr.isListening ? <LoadingOutlined spin /> : <AudioOutlined />}
        </button>
        <div className="celeb-mic-label">
          {asr.isListening ? '正在听...' : '按住说话 · Press Space'}
        </div>
      </div>

      {/* Add modal */}
      <Modal title="添加名人" open={addVisible} onCancel={() => setAddVisible(false)}
        onOk={handleAdd} okText="添加" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input placeholder="中文名" value={newName} onChange={e => setNewName(e.target.value)} />
          <Input placeholder="英文名" value={newNameEn} onChange={e => setNewNameEn(e.target.value)} />
          <Input placeholder="头衔" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <Input.TextArea placeholder="角色人设 System Prompt..." value={newPrompt} onChange={e => setNewPrompt(e.target.value)} rows={6} />
        </Space>
      </Modal>
    </div>
  );
}
