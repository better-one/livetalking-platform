import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Layout, Menu, Button, Select, Input, Card, Tag, Space, message, Tooltip,
  Row, Col, Statistic, Divider, Badge, Typography, Upload, Segmented, Tabs,
} from 'antd';
import {
  UserOutlined, PlayCircleOutlined, PauseCircleOutlined, SoundOutlined,
  DownloadOutlined, PlusOutlined, ReloadOutlined, CloudUploadOutlined,
  ExpandOutlined, VideoCameraOutlined, SettingOutlined, HomeOutlined,
  TeamOutlined, PlaySquareOutlined, CheckCircleOutlined, LoadingOutlined,
  ShareAltOutlined, ScissorOutlined, AudioOutlined, RobotOutlined,
  MessageOutlined, SwapOutlined, StarOutlined,
} from '@ant-design/icons';
import { useWebRTC } from './hooks/useWebRTC';
import { useSpeaking } from './hooks/useSpeaking';
import { avatarApi, sessionApi } from './services/api';
import { COLORS, TTS_ENGINES, VOICES, MODELS } from './constants';
import AvatarsPage from './pages/AvatarsPage';
import VideosPage from './pages/VideosPage';
import SettingsPage from './pages/SettingsPage';
import CelebrityPage from './pages/CelebrityPage';
import './App.css';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Text } = Typography;

interface AvatarItem { id: string; color: string; }

function App() {
  const [currentPage, setCurrentPage] = useState('workbench');
  const [avatars, setAvatars] = useState<AvatarItem[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Workbench form state
  const [ttsVoice, setTtsVoice] = useState('zh-CN-YunxiaNeural');
  const [scriptText, setScriptText] = useState('');
  const [sendMode, setSendMode] = useState<'echo' | 'chat'>('echo');
  const [isRecording, setIsRecording] = useState(false);

  // WebRTC hook
  const rtc = useWebRTC();
  const speaking = useSpeaking(rtc.sessionId);

  // Fetch avatars
  const fetchAvatars = useCallback(async () => {
    try {
      const d = await avatarApi.list();
      if (d.code === 0) {
        const list = d.data
          .filter((a: any) => a.status === 'ready')
          .map((a: any, i: number) => ({ id: a.id, color: COLORS[i % COLORS.length] }));
        setAvatars(list);
        if (!selectedAvatar && list.length > 0) setSelectedAvatar(list[0].id);
      }
    } catch {}
  }, [selectedAvatar]);

  useEffect(() => { fetchAvatars(); }, []);

  // Avatar switch: auto-reconnect
  const prevAvatar = useRef(selectedAvatar);
  useEffect(() => {
    if (prevAvatar.current && prevAvatar.current !== selectedAvatar && rtc.isConnected) {
      prevAvatar.current = selectedAvatar;
      message.loading({ content: `切换中 Switching...`, key: 'sw', duration: 3 });
      rtc.disconnect();
      setTimeout(() => rtc.connect(selectedAvatar), 500);
    } else {
      prevAvatar.current = selectedAvatar;
    }
  }, [selectedAvatar]);

  // Send text
  const sendText = useCallback(async () => {
    if (!scriptText.trim()) return message.warning('请输入文本');
    if (!rtc.sessionId) return message.warning('请先连接');
    try {
      await sessionApi.sendText(rtc.sessionId, scriptText, sendMode, ttsVoice);
      speaking.startPolling();
      message.success(sendMode === 'chat' ? 'AI 对话中...' : '已发送');
    } catch (e: any) {
      message.error(`失败: ${e.message}`);
    }
  }, [scriptText, rtc.sessionId, sendMode, ttsVoice, speaking]);

  // Interrupt
  const interrupt = useCallback(async () => {
    if (!rtc.sessionId) return;
    await sessionApi.interrupt(rtc.sessionId);
    speaking.stopSpeaking();
    message.info('已打断');
  }, [rtc.sessionId, speaking]);

  // Record
  const toggleRecord = useCallback(async () => {
    if (!rtc.sessionId) return message.warning('请先连接');
    await sessionApi.record(rtc.sessionId, !isRecording);
    setIsRecording(!isRecording);
    message.success(isRecording ? '录制停止' : '开始录制');
  }, [rtc.sessionId, isRecording]);

  // Upload audio
  const uploadAudio = useCallback(async (file: File) => {
    if (!rtc.sessionId) return message.warning('请先连接');
    await sessionApi.sendAudio(rtc.sessionId, file);
    message.success('音频已发送');
  }, [rtc.sessionId]);

  // Action state
  const setAction = useCallback(async (type: number) => {
    if (!rtc.sessionId) return message.warning('请先连接');
    await sessionApi.setAction(rtc.sessionId, type);
    message.success(`动作状态: ${type}`);
  }, [rtc.sessionId]);

  // Celebrity page: full-screen overlay
  if (currentPage === 'celebrity') {
    return <CelebrityPage onBack={() => setCurrentPage('workbench')} />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#001529' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 40 }}>
          <VideoCameraOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>LiveTalking 数字人平台</span>
        </div>
        <Menu theme="dark" mode="horizontal" selectedKeys={[currentPage]} style={{ flex: 1 }}
          onClick={({ key }) => { setCurrentPage(key); if (key === 'workbench') fetchAvatars(); }}
          items={[
            { key: 'workbench', icon: <HomeOutlined />, label: '工作台 Workbench' },
            { key: 'avatars', icon: <TeamOutlined />, label: '形象管理 Avatars' },
            { key: 'videos', icon: <PlaySquareOutlined />, label: '视频列表 Videos' },
            { key: 'celebrity', icon: <StarOutlined />, label: '名人聊天 Celebrity' },
            { key: 'settings', icon: <SettingOutlined />, label: '设置 Settings' },
          ]}
        />
        <Space>
          <Badge status={rtc.isConnected ? 'success' : 'default'} />
          <Text style={{ color: '#ffffffa6', fontSize: 13 }}>{rtc.isConnected ? '已连接' : '未连接'}</Text>
        </Space>
      </Header>

      <Layout>
        {currentPage === 'workbench' && (
          <Sider width={220} collapsible collapsed={collapsed} onCollapse={setCollapsed}
            style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
            {!collapsed && <div style={{ padding: '16px 16px 8px' }}><Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>形象库 GALLERY</Text></div>}
            <Menu mode="inline" selectedKeys={[selectedAvatar]}
              onClick={({ key }) => setSelectedAvatar(key)}
              items={avatars.map(a => ({ key: a.id, icon: <UserOutlined style={{ color: a.color }} />, label: a.id }))}
            />
            {!collapsed && (
              <div style={{ padding: 16 }}>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Button icon={<CloudUploadOutlined />} block onClick={() => setCurrentPage('avatars')}>上传视频</Button>
                  <Button icon={<PlusOutlined />} block onClick={() => setCurrentPage('avatars')}>新建形象</Button>
                </div>
              </div>
            )}
          </Sider>
        )}

        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          {currentPage === 'avatars' && <AvatarsPage />}
          {currentPage === 'videos' && <VideosPage />}
          {currentPage === 'settings' && <SettingsPage />}
          {currentPage === 'workbench' && (
            <Row gutter={16}>
              <Col flex="auto">
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Text type="secondary">工作台</Text><Text type="secondary">/</Text>
                      <Text strong>{selectedAvatar}</Text>
                    </Space>
                    <Space>
                      {rtc.isConnected && <Tag icon={<CheckCircleOutlined />} color="success">运行中</Tag>}
                      {speaking.isSpeaking && <Tag icon={<LoadingOutlined spin />} color="processing">说话中</Tag>}
                      {isRecording && <Tag icon={<LoadingOutlined spin />} color="error">录制中</Tag>}
                    </Space>
                  </div>

                  <Card title="实时预览 Live Preview"
                    extra={<Space>
                      <Tag color={rtc.fps >= 20 ? 'green' : rtc.fps > 0 ? 'orange' : 'default'}>{rtc.fps} FPS</Tag>
                      <Tooltip title="全屏"><Button type="text" icon={<ExpandOutlined />} size="small" /></Tooltip>
                    </Space>}
                    styles={{ body: { padding: 0 } }}>
                    <div style={{ background: '#000', minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <video ref={rtc.videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: 500, display: rtc.isPlaying ? 'block' : 'none' }} />
                      <audio ref={rtc.audioRef} autoPlay />
                      {!rtc.isPlaying && (
                        <div style={{ textAlign: 'center', color: '#ffffff73' }}>
                          <UserOutlined style={{ fontSize: 80, display: 'block', marginBottom: 16 }} />
                          <Text style={{ color: '#ffffff73' }}>点击下方按钮连接</Text>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f0f0f0' }}>
                      {!rtc.isConnected
                        ? <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => rtc.connect(selectedAvatar)}>连接</Button>
                        : <Button danger icon={<PauseCircleOutlined />} onClick={rtc.disconnect}>断开</Button>}
                      <Button icon={<ScissorOutlined />} onClick={interrupt} disabled={!speaking.isSpeaking}>打断</Button>
                      <div style={{ flex: 1 }} />
                      <Button type={isRecording ? 'primary' : 'default'} danger={isRecording} icon={<VideoCameraOutlined />}
                        onClick={toggleRecord} disabled={!rtc.isConnected}>
                        {isRecording ? '停止录制' : '录制'}
                      </Button>
                      <SoundOutlined style={{ fontSize: 16, color: '#00000073' }} />
                    </div>
                  </Card>
                </Space>
              </Col>

              <Col flex="360px">
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Card size="small" styles={{ body: { padding: 0 } }}>
                    <Tabs size="small" style={{ padding: '0 12px' }} items={[
                      { key: 'text', label: <span><MessageOutlined /> 文本</span>, children: (
                        <Space direction="vertical" style={{ width: '100%', padding: '0 4px 12px' }} size={12}>
                          <Segmented value={sendMode} onChange={v => setSendMode(v as any)} block
                            options={[{ value: 'echo', label: '播报 Echo' }, { value: 'chat', label: 'AI 对话' }]} />
                          <div>
                            <Text style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>音色 Voice</Text>
                            <Select value={ttsVoice} onChange={setTtsVoice} style={{ width: '100%' }} size="small" options={VOICES} />
                          </div>
                          <TextArea value={scriptText} onChange={e => setScriptText(e.target.value)}
                            placeholder={sendMode === 'chat' ? '输入问题...' : '输入播报文字...'}
                            maxLength={500} rows={3} />
                          <Button type="primary" icon={sendMode === 'chat' ? <RobotOutlined /> : <PlayCircleOutlined />}
                            block onClick={sendText} loading={speaking.isSpeaking} disabled={!rtc.isConnected}>
                            {speaking.isSpeaking ? '生成中...' : sendMode === 'chat' ? 'AI 对话' : '播报'}
                          </Button>
                        </Space>
                      )},
                      { key: 'audio', label: <span><AudioOutlined /> 音频</span>, children: (
                        <div style={{ padding: '0 4px 12px' }}>
                          <Upload.Dragger accept="audio/*" maxCount={1} showUploadList={false}
                            beforeUpload={(file) => { uploadAudio(file); return false; }}>
                            <p><AudioOutlined style={{ fontSize: 28, color: '#1677ff' }} /></p>
                            <p style={{ fontSize: 13 }}>上传音频驱动数字人</p>
                            <p style={{ fontSize: 11, color: '#00000073' }}>WAV/MP3/OGG</p>
                          </Upload.Dragger>
                        </div>
                      )},
                      { key: 'action', label: <span><SwapOutlined /> 动作</span>, children: (
                        <div style={{ padding: '0 4px 12px' }}>
                          <Row gutter={[8, 8]}>
                            {['空闲', '回复', '思考', '离开'].map((label, i) => (
                              <Col span={12} key={i}>
                                <Button block size="small" onClick={() => setAction(i)} disabled={!rtc.isConnected}>{label}</Button>
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )},
                    ]} />
                  </Card>
                  <Card title="状态 Status" size="small">
                    <Row gutter={[16, 12]}>
                      <Col span={12}><Statistic title="FPS" value={rtc.fps} suffix="fps" valueStyle={{ color: rtc.fps >= 20 ? '#52c41a' : '#faad14', fontSize: 20 }} /></Col>
                      <Col span={12}><Statistic title="形象数" value={avatars.length} suffix="个" valueStyle={{ fontSize: 20 }} /></Col>
                      <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>状态</Text><div><Tag color={rtc.isConnected ? 'green' : 'default'}>{rtc.isConnected ? '在线' : '离线'}</Tag></div></Col>
                      <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>Session</Text><div><Text code style={{ fontSize: 11 }}>{rtc.sessionId ? rtc.sessionId.slice(0, 8) : '-'}</Text></div></Col>
                    </Row>
                  </Card>
                </Space>
              </Col>
            </Row>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
