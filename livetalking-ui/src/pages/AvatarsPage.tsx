import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Row, Col, Button, Tag, Space, Modal, Upload, Input, Progress,
  Typography, Tooltip, Descriptions, message, Popconfirm, Select, InputNumber,
} from 'antd';
import {
  UserOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  PlayCircleOutlined, CloudUploadOutlined, EyeOutlined,
  CheckCircleOutlined, ClockCircleOutlined, InfoCircleOutlined,
  ReloadOutlined, VideoCameraOutlined, LoadingOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Search } = Input;

interface Avatar {
  id: string;
  name: string;
  nameEn: string;
  frames: number;
  resolution: string;
  status: 'ready' | 'generating' | 'error';
  model: string;
  createdAt: string;
  size: string;
  color: string;
  preview?: string;
  progress?: number;
  message?: string;
}

import { COLORS } from '../constants';
import { avatarApi } from '../services/api';

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newImgSize, setNewImgSize] = useState(256);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch avatar list from backend
  const fetchAvatars = useCallback(async () => {
    setLoading(true);
    try {
      const data = await avatarApi.list();
      if (data.code === 0) {
        const list: Avatar[] = data.data.map((a: any, i: number) => ({
          id: a.id,
          name: a.id,
          nameEn: a.id,
          frames: a.frames,
          resolution: a.resolution || '-',
          status: a.status,
          model: 'wav2lip',
          createdAt: '-',
          size: a.size,
          color: COLORS[i % COLORS.length],
          preview: avatarApi.preview(a.id),
          progress: a.progress,
          message: a.message,
        }));
        setAvatars(list);
      }
    } catch (e: any) {
      message.error(`获取列表失败 Failed: ${e.message}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAvatars(); }, [fetchAvatars]);

  // Poll progress for generating avatars
  useEffect(() => {
    const generating = avatars.filter(a => a.status === 'generating');
    if (generating.length === 0) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return; // already polling

    pollRef.current = setInterval(async () => {
      let changed = false;
      for (const av of generating) {
        try {
          const data = await avatarApi.progress(av.id);
          if (data.code === 0) {
            const prog = data.data;
            setAvatars(prev => prev.map(a => a.id === av.id ? {
              ...a,
              progress: prog.progress,
              message: prog.message,
              status: prog.status === 'ready' ? 'ready' : prog.status === 'error' ? 'error' : 'generating',
              frames: prog.face_count || a.frames,
            } : a));
            if (prog.status === 'ready' || prog.status === 'error') {
              changed = true;
            }
          }
        } catch { /* ignore */ }
      }
      if (changed) {
        fetchAvatars(); // refresh full list
      }
    }, 2000);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [avatars, fetchAvatars]);

  const filtered = avatars.filter(a =>
    a.name.includes(search) || a.nameEn.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search)
  );

  const statusConfig: Record<string, any> = {
    ready: { color: 'success', icon: <CheckCircleOutlined />, text: '就绪 Ready' },
    generating: { color: 'processing', icon: <LoadingOutlined spin />, text: '生成中 Generating' },
    error: { color: 'error', icon: <InfoCircleOutlined />, text: '失败 Error' },
  };

  const handleDelete = async (id: string) => {
    try {
      await avatarApi.delete(id);
      setAvatars(prev => prev.filter(a => a.id !== id));
      message.success('已删除 Deleted');
    } catch (e: any) {
      message.error(`删除失败 Failed: ${e.message}`);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { message.warning('请输入名称 Enter name'); return; }
    if (!videoFile) { message.warning('请上传视频 Upload video'); return; }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('avatar_id', newName.trim());
      formData.append('img_size', String(newImgSize));
      formData.append('video', videoFile);

      const data = await avatarApi.create(formData);

      if (data.code === 0) {
        message.success('创建任务已提交 Generation started');
        setUploadVisible(false);
        setNewName('');
        setVideoFile(null);
        // Add placeholder to list immediately
        setAvatars(prev => [...prev, {
          id: newName.trim(),
          name: newName.trim(),
          nameEn: newName.trim(),
          frames: 0,
          resolution: '-',
          status: 'generating',
          model: 'wav2lip',
          createdAt: new Date().toISOString().slice(0, 10),
          size: '-',
          color: COLORS[prev.length % COLORS.length],
          progress: 0,
          message: '开始处理 Starting...',
        }]);
      } else {
        message.error(`创建失败 Failed: ${data.msg}`);
      }
    } catch (e: any) {
      message.error(`创建失败 Failed: ${e.message}`);
    }
    setCreating(false);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>形象管理 Avatar Management</Title>
            <Text type="secondary">管理和创建数字人形象 Manage and create digital human avatars</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAvatars} loading={loading}>刷新 Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadVisible(true)}>
              新建形象 New Avatar
            </Button>
          </Space>
        </div>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: '总数 Total', value: avatars.length, color: undefined, icon: <UserOutlined style={{ fontSize: 28, color: '#1677ff33' }} /> },
          { label: '就绪 Ready', value: avatars.filter(a => a.status === 'ready').length, color: '#52c41a', icon: <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a33' }} /> },
          { label: '生成中 Generating', value: avatars.filter(a => a.status === 'generating').length, color: '#1677ff', icon: <ClockCircleOutlined style={{ fontSize: 28, color: '#1677ff33' }} /> },
          { label: '失败 Failed', value: avatars.filter(a => a.status === 'error').length, color: '#ff4d4f', icon: <InfoCircleOutlined style={{ fontSize: 28, color: '#ff4d4f33' }} /> },
        ].map((s, i) => (
          <Col span={6} key={i}>
            <Card size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
                {s.icon}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <Search placeholder="搜索形象 Search avatars..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 320 }} allowClear />
      </div>

      {/* Grid */}
      <Row gutter={[16, 16]}>
        {filtered.map(avatar => {
          const st = statusConfig[avatar.status] || statusConfig.error;
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={avatar.id}>
              <Card hoverable styles={{ body: { padding: 0 } }}
                actions={[
                  <Tooltip title="预览 Preview" key="p"><EyeOutlined onClick={() => { setSelectedAvatar(avatar); setDetailVisible(true); }} /></Tooltip>,
                  <Tooltip title="使用 Use" key="u"><PlayCircleOutlined onClick={() => message.info(`切换到 ${avatar.id}`)} /></Tooltip>,
                  <Tooltip title="编辑 Edit" key="e"><EditOutlined /></Tooltip>,
                  <Popconfirm title="确定删除？Delete?" onConfirm={() => handleDelete(avatar.id)} key="d">
                    <DeleteOutlined style={{ color: '#ff4d4f' }} />
                  </Popconfirm>,
                ]}>
                <div style={{ height: 180, background: `linear-gradient(135deg, ${avatar.color}15, ${avatar.color}05)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {avatar.preview ? (
                    <img src={avatar.preview} alt={avatar.id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <UserOutlined style={{ fontSize: 56, color: avatar.color }} />
                  )}
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Tag icon={st.icon} color={st.color}>{st.text}</Tag>
                  </div>
                  {avatar.status === 'generating' && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 12px 8px', background: 'rgba(0,0,0,0.6)' }}>
                      <div style={{ color: '#fff', fontSize: 11, marginBottom: 4 }}>{avatar.message}</div>
                      <Progress percent={avatar.progress || 0} size="small" strokeColor="#1677ff"
                        trailColor="rgba(255,255,255,0.2)" showInfo={false} />
                      <div style={{ color: '#ffffffaa', fontSize: 11, textAlign: 'right' }}>{avatar.progress || 0}%</div>
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text strong>{avatar.id}</Text>
                    <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{avatar.model}</Tag>
                  </div>
                  <Space size={16}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{avatar.frames} 帧</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{avatar.resolution}</Text>
                  </Space>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{avatar.size}</Text>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}

        {/* Add New */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card hoverable style={{ height: '100%', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setUploadVisible(true)}>
            <div style={{ textAlign: 'center', color: '#00000040' }}>
              <PlusOutlined style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
              <Text type="secondary">新建形象 New Avatar</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Detail Modal */}
      <Modal title={`${selectedAvatar?.id} - 详情 Details`} open={detailVisible}
        onCancel={() => setDetailVisible(false)} width={640}
        footer={[
          <Button key="c" onClick={() => setDetailVisible(false)}>关闭 Close</Button>,
          <Button key="u" type="primary" icon={<PlayCircleOutlined />}
            onClick={() => { message.success(`已切换 Switched to ${selectedAvatar?.id}`); setDetailVisible(false); }}>
            使用此形象 Use Avatar
          </Button>,
        ]}>
        {selectedAvatar && (
          <div>
            <div style={{ height: 240, borderRadius: 8, overflow: 'hidden', marginBottom: 16,
              background: `linear-gradient(135deg, ${selectedAvatar.color}20, ${selectedAvatar.color}08)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedAvatar.preview ? (
                <img src={selectedAvatar.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserOutlined style={{ fontSize: 80, color: selectedAvatar.color }} />
              )}
            </div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="ID">{selectedAvatar.id}</Descriptions.Item>
              <Descriptions.Item label="状态 Status">
                <Tag color={statusConfig[selectedAvatar.status]?.color}>{statusConfig[selectedAvatar.status]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="帧数 Frames">{selectedAvatar.frames}</Descriptions.Item>
              <Descriptions.Item label="分辨率 Resolution">{selectedAvatar.resolution}</Descriptions.Item>
              <Descriptions.Item label="模型 Model"><Tag color="blue">{selectedAvatar.model}</Tag></Descriptions.Item>
              <Descriptions.Item label="大小 Size">{selectedAvatar.size}</Descriptions.Item>
            </Descriptions>
            {selectedAvatar.status === 'generating' && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">{selectedAvatar.message}</Text>
                <Progress percent={selectedAvatar.progress || 0} status="active" />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal title="新建形象 Create New Avatar" open={uploadVisible}
        onCancel={() => { setUploadVisible(false); setVideoFile(null); setNewName(''); }}
        footer={[
          <Button key="c" onClick={() => { setUploadVisible(false); setVideoFile(null); setNewName(''); }}>取消 Cancel</Button>,
          <Button key="s" type="primary" icon={<VideoCameraOutlined />}
            loading={creating} onClick={handleCreate}
            disabled={!newName.trim() || !videoFile}>
            开始生成 Start Generation
          </Button>,
        ]}
        width={520}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Text style={{ display: 'block', marginBottom: 8 }}>形象ID Avatar ID <Text type="danger">*</Text></Text>
            <Input placeholder="例如：my_host (英文/数字/下划线)" value={newName}
              onChange={e => setNewName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 8 }}>上传视频 Upload Video <Text type="danger">*</Text></Text>
            <Upload.Dragger
              accept="video/*"
              maxCount={1}
              beforeUpload={(file) => { setVideoFile(file); return false; }}
              onRemove={() => setVideoFile(null)}
              fileList={videoFile ? [{ uid: '-1', name: videoFile.name, status: 'done', size: videoFile.size }] : []}
            >
              <p style={{ marginBottom: 8 }}>
                <CloudUploadOutlined style={{ fontSize: 32, color: '#1677ff' }} />
              </p>
              <p>点击或拖拽视频文件到此处</p>
              <p style={{ color: '#00000073', fontSize: 12 }}>Click or drag video file here</p>
              <p style={{ color: '#00000040', fontSize: 11 }}>支持 MP4/AVI/MOV，建议正脸、闭嘴、5-30秒</p>
            </Upload.Dragger>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Text style={{ display: 'block', marginBottom: 8 }}>人脸尺寸 Face Size</Text>
              <InputNumber value={newImgSize} onChange={v => setNewImgSize(v || 256)}
                min={96} max={512} step={32} suffix="px" style={{ width: '100%' }} />
            </Col>
            <Col span={12}>
              <Text style={{ display: 'block', marginBottom: 8 }}>模型 Model</Text>
              <Select value="wav2lip" style={{ width: '100%' }} disabled
                options={[{ value: 'wav2lip', label: 'Wav2Lip (256)' }]} />
            </Col>
          </Row>
        </Space>
      </Modal>
    </div>
  );
}
