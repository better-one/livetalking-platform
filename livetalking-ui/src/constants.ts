/**
 * 全局常量 — 消除重复定义
 */

export const COLORS = [
  '#1677ff', '#eb2f96', '#52c41a', '#722ed1',
  '#faad14', '#13c2c2', '#fa541c', '#2f54eb',
];

export const TTS_ENGINES = [
  { value: 'kokoro', label: 'Kokoro (本地低延迟 Local)' },
  { value: 'edgetts', label: 'EdgeTTS (在线 Online)' },
  { value: 'gpt-sovits', label: 'GPT-SoVITS (克隆 Clone)' },
  { value: 'cosyvoice', label: 'CosyVoice (阿里 Ali)' },
  { value: 'fishtts', label: 'FishTTS' },
  { value: 'doubao', label: '豆包 Doubao' },
  { value: 'azuretts', label: 'Azure TTS' },
  { value: 'xtts', label: 'XTTS' },
];

export const VOICES = [
  { value: 'zh-CN-YunxiaNeural', label: '云霞 Yunxia (女)' },
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 Xiaoxiao (女)' },
  { value: 'zh-CN-YunxiNeural', label: '云希 Yunxi (男)' },
  { value: 'zh-CN-YunyangNeural', label: '云扬 Yunyang (男)' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊 Xiaoyi (女)' },
];

export const MODELS = [
  { value: 'wav2lip', label: 'Wav2Lip (256)' },
  { value: 'musetalk', label: 'MuseTalk' },
  { value: 'ultralight', label: 'Ultralight' },
];
