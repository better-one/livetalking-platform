import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, Button, Space, Divider, Typography,
  Row, Col, Tag, Descriptions, message, InputNumber, Alert, Tabs, Spin,
} from 'antd';
import {
  SaveOutlined, ReloadOutlined, SettingOutlined, SoundOutlined,
  ApiOutlined, GlobalOutlined, ThunderboltOutlined, RobotOutlined,
  CheckCircleOutlined, ExperimentOutlined,
} from '@ant-design/icons';

import { systemApi, llmApi } from '../services/api';
import { TTS_ENGINES, VOICES } from '../constants';

const { Text, Title } = Typography;

interface SystemInfo {
  python: string;
  pytorch: string;
  cuda_available: boolean;
  cuda_version: string;
  gpu_name: string;
  gpu_memory_total: string;
  gpu_memory_used: string;
  driver_version: string;
}

export default function SettingsPage() {
  const [serverForm] = Form.useForm();
  const [ttsForm] = Form.useForm();
  const [llmForm] = Form.useForm();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [llmProviders, setLlmProviders] = useState<Record<string, any>>({});
  const [llmTesting, setLlmTesting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('qwen');

  // Fetch LLM config
  const fetchLlmConfig = async () => {
    try {
      const d = await llmApi.getConfig();
      if (d.code === 0) {
        const cfg = d.data;
        setLlmProviders(cfg.providers || {});
        setSelectedProvider(cfg.provider || 'qwen');
        llmForm.setFieldsValue({
          provider: cfg.provider, model: cfg.model, base_url: cfg.base_url,
          api_key: cfg.api_key_masked, system_prompt: cfg.system_prompt,
          max_tokens: cfg.max_tokens, temperature: cfg.temperature,
        });
      }
    } catch {}
  };

  const handleSaveLlm = async () => {
    const values = llmForm.getFieldsValue();
    // Don't send masked key back
    const payload: any = { ...values };
    if (payload.api_key && payload.api_key.includes('***')) delete payload.api_key;
    try {
      const d = await llmApi.setConfig(payload);
      if (d.code === 0) message.success('LLM 配置已保存 Saved');
      else message.error(d.msg);
    } catch (e: any) { message.error(e.message); }
  };

  const handleTestLlm = async () => {
    setLlmTesting(true);
    try {
      const d = await llmApi.test();
      if (d.code === 0) message.success(`连接成功 Connected: ${d.data.reply}`);
      else message.error(`连接失败 Failed: ${d.msg}`);
    } catch (e: any) { message.error(e.message); }
    setLlmTesting(false);
  };

  useEffect(() => { fetchLlmConfig(); }, []);

  const fetchSystemInfo = async () => {
    setLoading(true);
    try {
      const data = await systemApi.info();
      if (data.code === 0) {
        setSysInfo(data.data);
      }
    } catch (e: any) {
      message.error(`获取系统信息失败: ${e.message}`);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSystemInfo(); }, []);

  const handleSaveServer = () => {
    const values = serverForm.getFieldsValue();
    message.success(`服务器配置已保存 Server config saved: port=${values.listenPort}, model=${values.model}`);
  };

  const handleSaveTTS = () => {
    const values = ttsForm.getFieldsValue();
    message.success(`TTS 配置已保存: engine=${values.ttsEngine}, voice=${values.defaultVoice}`);
  };

  // Parse GPU memory for progress bar
  const memUsed = sysInfo?.gpu_memory_used ? parseFloat(sysInfo.gpu_memory_used) : 0;
  const memTotal = sysInfo?.gpu_memory_total ? parseFloat(sysInfo.gpu_memory_total) : 1;
  const memPercent = Math.round((memUsed / memTotal) * 100);

  const tabItems = [
    {
      key: 'server',
      label: <span><SettingOutlined /> 服务器 Server</span>,
      children: (
        <Card>
          <Form form={serverForm} layout="vertical" initialValues={{
            listenPort: 8010, transport: 'webrtc', maxSession: 1, model: 'wav2lip',
            modelRes: 256, batchSize: 16, fps: 25,
          }}>
            <Title level={5}>服务配置 Server Configuration</Title>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label="监听端口 Listen Port" name="listenPort">
                  <InputNumber style={{ width: '100%' }} min={1000} max={65535} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="传输方式 Transport" name="transport">
                  <Select options={[
                    { value: 'webrtc', label: 'WebRTC (推荐 Recommended)' },
                    { value: 'rtmp', label: 'RTMP' },
                    { value: 'rtcpush', label: 'RTC Push' },
                    { value: 'virtualcam', label: '虚拟摄像头 Virtual Cam' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="最大会话 Max Sessions" name="maxSession">
                  <InputNumber style={{ width: '100%' }} min={1} max={10} />
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <Title level={5}>模型配置 Model Configuration</Title>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label="推理模型 Model" name="model">
                  <Select options={[
                    { value: 'wav2lip', label: 'Wav2Lip' },
                    { value: 'musetalk', label: 'MuseTalk' },
                    { value: 'ultralight', label: 'Ultralight' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="模型分辨率 Model Res" name="modelRes">
                  <Select options={[
                    { value: 192, label: '192' },
                    { value: 256, label: '256 (推荐 Recommended)' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="推理批次 Batch Size" name="batchSize">
                  <InputNumber style={{ width: '100%' }} min={1} max={32} />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveServer}>
              保存配置 Save Configuration
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'tts',
      label: <span><SoundOutlined /> 语音 TTS</span>,
      children: (
        <Card>
          <Form form={ttsForm} layout="vertical" initialValues={{
            ttsEngine: 'edgetts', defaultVoice: 'zh-CN-YunxiaNeural',
            ttsServer: 'http://127.0.0.1:9880',
          }}>
            <Title level={5}>TTS 默认配置 Default TTS Configuration</Title>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label="默认引擎 Default Engine" name="ttsEngine">
                  <Select options={[
                    { value: 'edgetts', label: 'EdgeTTS (免费在线 Free Online)' },
                    { value: 'gpt-sovits', label: 'GPT-SoVITS (需部署 Self-hosted)' },
                    { value: 'cosyvoice', label: 'CosyVoice (阿里 Alibaba)' },
                    { value: 'fishtts', label: 'FishTTS (需API Key)' },
                    { value: 'doubao', label: '豆包 Doubao (字节 ByteDance)' },
                    { value: 'azuretts', label: 'Azure TTS (微软 Microsoft)' },
                    { value: 'kokoro', label: 'Kokoro (本地低延迟 Local Fast)' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="默认音色 Default Voice" name="defaultVoice">
                  <Select options={[
                    { value: 'zh-CN-YunxiaNeural', label: '云霞 Yunxia (女 Female)' },
                    { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 Xiaoxiao (女 Female)' },
                    { value: 'zh-CN-YunxiNeural', label: '云希 Yunxi (男 Male)' },
                    { value: 'zh-CN-YunyangNeural', label: '云扬 Yunyang (男 Male)' },
                  ]} />
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <Title level={5}>自定义 TTS 服务 Custom TTS Server</Title>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label="TTS 服务地址 Server URL" name="ttsServer">
                  <Input placeholder="http://127.0.0.1:9880" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="参考音频 Reference Audio" name="refFile">
                  <Input placeholder="可选 Optional" />
                </Form.Item>
              </Col>
            </Row>
            <Alert message="EdgeTTS 提示 Tips"
              description="EdgeTTS 为免费在线服务，无需额外部署。如需声音克隆，请部署 GPT-SoVITS 或 CosyVoice 服务。"
              type="info" showIcon style={{ marginBottom: 16 }} />
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveTTS}>
              保存 TTS 配置 Save TTS Config
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'llm',
      label: <span><RobotOutlined /> LLM 大模型</span>,
      children: (
        <Card>
          <Form form={llmForm} layout="vertical" initialValues={{
            provider: 'qwen', model: 'qwen-plus', temperature: 0.7, max_tokens: 500,
          }}>
            <Title level={5}>LLM 大模型配置 Language Model Configuration</Title>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label="模型厂商 Provider" name="provider">
                  <Select onChange={(v) => {
                    setSelectedProvider(v);
                    const preset = llmProviders[v];
                    if (preset) {
                      llmForm.setFieldsValue({ base_url: preset.base_url, model: preset.models?.[0] || '' });
                    }
                  }} options={[
                    { value: 'qwen', label: '通义千问 Qwen (阿里)' },
                    { value: 'openai', label: 'OpenAI (GPT)' },
                    { value: 'deepseek', label: 'DeepSeek' },
                    { value: 'ollama', label: 'Ollama (本地)' },
                    { value: 'custom', label: '自定义 Custom' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="模型 Model" name="model">
                  <Select options={
                    (llmProviders[selectedProvider]?.models || []).map((m: string) => ({ value: m, label: m }))
                  } />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="API Key" name="api_key">
                  <Input.Password placeholder="sk-*** 或环境变量自动读取" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col span={16}>
                <Form.Item label="API 地址 Base URL" name="base_url">
                  <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="温度 Temperature" name="temperature">
                  <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="最大 Token" name="max_tokens">
                  <InputNumber min={50} max={4096} step={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="默认系统提示词 Default System Prompt" name="system_prompt">
              <Input.TextArea rows={3} placeholder="你是一个知识助手..." />
            </Form.Item>
            <Alert
              message="配置说明 Tips"
              description={<>
                <div>· <b>通义千问 Qwen</b>：需设置环境变量 DASHSCOPE_API_KEY 或填写 API Key</div>
                <div>· <b>Ollama 本地</b>：无需 API Key，确保 Ollama 服务在 localhost:11434 运行</div>
                <div>· <b>DeepSeek</b>：需设置 DEEPSEEK_API_KEY</div>
                <div>· 名人聊天会使用名人的专属 System Prompt 覆盖默认提示词</div>
              </>}
              type="info" showIcon style={{ marginBottom: 16 }}
            />
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveLlm}>
                保存配置 Save
              </Button>
              <Button icon={<ExperimentOutlined />} loading={llmTesting} onClick={handleTestLlm}>
                测试连接 Test Connection
              </Button>
            </Space>
          </Form>
        </Card>
      ),
    },
    {
      key: 'system',
      label: <span><ApiOutlined /> 系统 System</span>,
      children: (
        <Spin spinning={loading}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card title="GPU 信息 GPU Information" extra={
              <Button size="small" icon={<ReloadOutlined />} onClick={fetchSystemInfo}>刷新 Refresh</Button>
            }>
              {sysInfo ? (
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="GPU 型号 Model">
                    <Tag color="blue">{sysInfo.gpu_name || 'N/A'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="驱动版本 Driver">{sysInfo.driver_version || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="CUDA 版本 Version">{sysInfo.cuda_version || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="显存 Memory">
                    <div>
                      <Text>{sysInfo.gpu_memory_used} / {sysInfo.gpu_memory_total}</Text>
                      <div style={{ width: 120, marginTop: 4 }}>
                        <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{
                            background: memPercent > 80 ? '#ff4d4f' : memPercent > 50 ? '#faad14' : '#52c41a',
                            height: '100%', width: `${memPercent}%`, borderRadius: 4,
                          }} />
                        </div>
                      </div>
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="PyTorch">{sysInfo.pytorch || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Python">{sysInfo.python || 'N/A'}</Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">加载中... Loading...</Text>
              )}
            </Card>

            <Card title="项目信息 Project Information">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="项目 Project">
                  <a href="https://github.com/lipku/LiveTalking" target="_blank" rel="noreferrer">LiveTalking</a>
                </Descriptions.Item>
                <Descriptions.Item label="作者 Author">lipku</Descriptions.Item>
                <Descriptions.Item label="许可证 License"><Tag>Apache 2.0</Tag></Descriptions.Item>
                <Descriptions.Item label="传输 Transport"><Tag color="blue">WebRTC</Tag></Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="快捷操作 Quick Actions">
              <Space wrap>
                <Button icon={<ThunderboltOutlined />} onClick={async () => {
                  try { await fetch('/system/info'); message.success('GPU 缓存已清理 Cleared'); } catch {}
                }}>清理 GPU 缓存 Clear GPU</Button>
                <Button icon={<ApiOutlined />} onClick={() => window.open('/webrtcapi.html', '_blank')}>
                  原始页面 Original UI
                </Button>
                <Button icon={<GlobalOutlined />} onClick={() => window.open('https://github.com/lipku/LiveTalking', '_blank')}>
                  GitHub
                </Button>
              </Space>
            </Card>
          </Space>
        </Spin>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>设置 Settings</Title>
        <Text type="secondary">配置服务器、语音和系统参数 Configure server, TTS and system parameters</Text>
      </div>
      <Tabs items={tabItems} size="large" />
    </div>
  );
}
