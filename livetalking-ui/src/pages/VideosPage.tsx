import { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Tag, Space, Typography, Modal,
  Tooltip, Popconfirm, message, Row, Col, Empty,
} from 'antd';
import { systemApi } from '../services/api';
import {
  DownloadOutlined, DeleteOutlined, PlayCircleOutlined, EyeOutlined,
  ReloadOutlined, PlaySquareOutlined,
  CheckCircleOutlined, CloudDownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text, Title } = Typography;

interface VideoRecord {
  key: string;
  name: string;
  duration: string;
  resolution: string;
  size: string;
  status: string;
  progress: number;
  createdAt: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoRecord | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await systemApi.videoList();
      if (data.code === 0) {
        setVideos(data.data || []);
      }
    } catch (e: any) {
      message.error(`获取失败 Failed: ${e.message}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const handleDelete = async (filename: string) => {
    try {
      const data = await systemApi.videoDelete(filename);
      if (data.code === 0) {
        setVideos(prev => prev.filter(v => v.key !== filename));
        message.success('已删除 Deleted');
      } else {
        message.error(`删除失败: ${data.msg}`);
      }
    } catch (e: any) {
      message.error(`删除失败 Failed: ${e.message}`);
    }
  };

  const handleBatchDelete = async () => {
    for (const key of selectedRowKeys) {
      await handleDelete(key);
    }
    setSelectedRowKeys([]);
  };

  const columns: ColumnsType<VideoRecord> = [
    {
      title: '文件名 Filename',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <PlaySquareOutlined style={{ color: '#1677ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '时长 Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      align: 'center',
    },
    {
      title: '分辨率 Resolution',
      dataIndex: 'resolution',
      key: 'resolution',
      width: 120,
      align: 'center',
    },
    {
      title: '大小 Size',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      align: 'center',
    },
    {
      title: '状态 Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => {
        if (status === 'completed') return <Tag icon={<CheckCircleOutlined />} color="success">已完成 Done</Tag>;
        return <Tag color="default">{status}</Tag>;
      },
    },
    {
      title: '创建时间 Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作 Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="预览 Preview">
            <Button type="text" size="small" icon={<EyeOutlined />}
              onClick={() => { setPreviewVideo(record); setPreviewVisible(true); }} />
          </Tooltip>
          <Tooltip title="下载 Download">
            <Button type="text" size="small" icon={<DownloadOutlined />}
              onClick={() => message.success(`正在下载 Downloading ${record.name}`)} />
          </Tooltip>
          <Popconfirm title="确定删除？Delete?" onConfirm={() => handleDelete(record.key)}>
            <Tooltip title="删除 Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalSize = videos.reduce((sum, v) => {
    const match = v.size.match(/([\d.]+)/);
    return sum + (match ? parseFloat(match[1]) : 0);
  }, 0).toFixed(1);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>视频列表 Video Library</Title>
            <Text type="secondary">浏览和管理录制的数字人视频 Browse and manage recorded videos</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchVideos} loading={loading}>刷新 Refresh</Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm title={`确定删除 ${selectedRowKeys.length} 个视频？`} onConfirm={handleBatchDelete}>
                <Button danger icon={<DeleteOutlined />}>批量删除 Delete ({selectedRowKeys.length})</Button>
              </Popconfirm>
            )}
          </Space>
        </div>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>总视频 Total</Text>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{videos.length}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>已完成 Completed</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{videos.filter(v => v.status === 'completed').length}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>总大小 Total Size</Text>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{totalSize} MB</div>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card styles={{ body: { padding: 0 } }}>
        {videos.length > 0 ? (
          <Table
            rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
            columns={columns}
            dataSource={videos}
            loading={loading}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条 Total ${total}` }}
            size="middle"
          />
        ) : (
          <Empty description="暂无视频，请在工作台录制 No videos yet, record from Workbench"
            style={{ padding: 60 }} />
        )}
      </Card>

      {/* Preview Modal */}
      <Modal title={`预览 Preview - ${previewVideo?.name}`} open={previewVisible}
        onCancel={() => setPreviewVisible(false)} width={640}
        footer={[
          <Button key="c" onClick={() => setPreviewVisible(false)}>关闭 Close</Button>,
          <Button key="d" type="primary" icon={<CloudDownloadOutlined />}
            onClick={() => message.success(`正在下载 Downloading ${previewVideo?.name}`)}>
            下载 Download
          </Button>,
        ]}>
        {previewVideo && (
          <div>
            <div style={{ background: '#000', borderRadius: 8, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ textAlign: 'center', color: '#ffffff73' }}>
                <PlayCircleOutlined style={{ fontSize: 64, display: 'block', marginBottom: 8 }} />
                <Text style={{ color: '#ffffff73' }}>视频预览 Video Preview</Text>
              </div>
            </div>
            <Row gutter={16}>
              <Col span={8}><Text type="secondary">时长:</Text> <Text strong>{previewVideo.duration}</Text></Col>
              <Col span={8}><Text type="secondary">分辨率:</Text> <Text strong>{previewVideo.resolution}</Text></Col>
              <Col span={8}><Text type="secondary">大小:</Text> <Text strong>{previewVideo.size}</Text></Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}
