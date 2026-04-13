# LiveTalking 数字人平台

基于 [LiveTalking](https://github.com/lipku/LiveTalking) 的实时交互数字人平台，提供完整的 Web UI、名人聊天、多 TTS/LLM 引擎支持。

## 功能

- **实时数字人** — Wav2Lip 驱动口型，25fps 实时渲染，WebRTC 推流
- **形象管理** — 上传视频自动生成数字人形象，实时进度追踪
- **名人聊天** — 沉浸式全屏对话，预置爱因斯坦/斯大林，支持自定义名人
- **语音输入** — 浏览器端 ASR（Web Speech API），按 Space 键说话
- **多 TTS 引擎** — Kokoro 本地低延迟(175ms) / EdgeTTS / GPT-SoVITS / CosyVoice 等 8 种
- **多 LLM 支持** — 通义千问 / OpenAI / DeepSeek / Ollama(本地) / 自定义
- **视频录制** — 录制数字人视频，下载管理
- **动作编排** — 空闲/回复/思考/离开 4 种状态切换

## 环境要求

- Python 3.10+
- CUDA 12.0+（GPU 显存 4GB+）
- Node.js 18+
- PyTorch 2.5.0

## 快速开始

### 1. 安装后端

```bash
cd LiveTalking
python -m venv venv
source venv/Scripts/activate  # Windows
pip install torch==2.5.0 torchaudio==2.5.0 torchvision==0.20.0 --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
pip install kokoro soundfile ordered-set "misaki[zh]"
```

### 2. 下载模型

从 [夸克网盘](https://pan.quark.cn/s/83a750323ef0) 下载：
- `wav2lip256.pth` → 重命名为 `wav2lip.pth` 放到 `models/`
- `wav2lip256_avatar1.tar.gz` → 解压到 `data/avatars/`

### 3. 生成自定义形象

```bash
PYTHONPATH=. python avatars/wav2lip/genavatar.py \
  --video_path your_video.mp4 \
  --avatar_id your_avatar \
  --img_size 256 \
  --face_det_batch_size 4
```

### 4. 启动后端

```bash
python app.py --transport webrtc --model wav2lip --avatar_id your_avatar --modelres 256 --tts kokoro
```

### 5. 安装前端

```bash
cd livetalking-ui
npm install
```

### 6. 启动前端

```bash
npx vite --port 3000
```

打开 http://localhost:3000

## 页面说明

| 页面 | 路径 | 说明 |
|------|------|------|
| 工作台 | / | WebRTC 连接、文本/音频驱动、录制 |
| 形象管理 | /avatars | 上传视频、生成形象、进度追踪 |
| 视频列表 | /videos | 录制视频管理、预览、下载 |
| 名人聊天 | /celebrity | 沉浸式全屏 AI 角色对话 |
| 设置 | /settings | 服务器/TTS/LLM/系统配置 |

## 项目结构

```
├── LiveTalking/                # 后端
│   ├── app.py                  # 主入口
│   ├── llm.py                  # LLM 多厂商支持
│   ├── config.py               # CLI 参数
│   ├── server/
│   │   ├── routes.py           # 核心 API (/human /record)
│   │   ├── avatar_api.py       # 形象管理 API
│   │   ├── celebrity_api.py    # 名人聊天 API
│   │   ├── system_api.py       # 系统信息 API
│   │   └── llm_api.py          # LLM 配置 API
│   ├── tts/
│   │   ├── kokoro_tts.py       # Kokoro 本地 TTS (175ms)
│   │   ├── edge.py             # EdgeTTS
│   │   └── ...                 # 8 种 TTS 引擎
│   └── avatars/
│       ├── wav2lip_avatar.py   # Wav2Lip (含嘴巴增强)
│       └── ...
│
├── livetalking-ui/             # 前端
│   └── src/
│       ├── App.tsx             # 路由 + 工作台
│       ├── constants.ts        # 全局常量
│       ├── hooks/
│       │   ├── useWebRTC.ts    # WebRTC 连接
│       │   ├── useSpeaking.ts  # 说话状态轮询
│       │   └── useASR.ts       # 浏览器语音识别
│       ├── services/
│       │   └── api.ts          # 统一 API 层
│       └── pages/
│           ├── AvatarsPage.tsx
│           ├── VideosPage.tsx
│           ├── SettingsPage.tsx
│           └── CelebrityPage.tsx
│
└── TEST_REPORT.md              # 测试报告 (115 项全部通过)
```

## API 端点

### 会话控制

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /offer | WebRTC 信令，avatar 参数选择形象 |
| POST | /human | 文本输入，type=echo 播报 / type=chat AI 对话 |
| POST | /humanaudio | 上传音频驱动口型 |
| POST | /interrupt_talk | 打断当前说话 |
| POST | /is_speaking | 查询说话状态 |
| POST | /record | 录制控制 (start_record / end_record) |
| POST | /set_audiotype | 动作编排状态切换 |

### 形象管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /avatar/list | 列表（含状态/帧数/分辨率） |
| POST | /avatar/create | 上传视频生成形象 |
| POST | /avatar/progress | 查询生成进度 |
| POST | /avatar/delete | 删除形象 |
| GET | /avatar/preview/{id} | 人脸裁剪预览图 |

### 名人聊天

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /celebrity/list | 名人列表 |
| POST | /celebrity/chat | AI 角色对话（注入人设 prompt） |
| POST | /celebrity/add | 添加自定义名人 |

### 系统配置

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /system/info | GPU/CUDA/PyTorch 信息 |
| GET | /video/list | 录制视频列表 |
| GET/POST | /llm/config | LLM 配置读写 |
| POST | /llm/test | 测试 LLM 连接 |

## 配置 LLM

### 通义千问 (默认)

```bash
export DASHSCOPE_API_KEY="sk-xxx"
```

### Ollama 本地

```bash
ollama pull qwen2.5:7b
# 设置页面选择 Ollama，无需 API Key
```

### 自定义

设置页面 → LLM 大模型 Tab → 填写 Base URL 和 API Key

## 性能

| 指标 | 数值 |
|------|------|
| Wav2Lip 推理 | 65 fps |
| 视频输出 | 25 fps (稳定) |
| Kokoro TTS 延迟 | ~175ms |
| EdgeTTS 延迟 | ~2,400ms |
| GPU 显存 | ~2.3 GB (RTX 4060) |

## 致谢

- [LiveTalking](https://github.com/lipku/LiveTalking) — 实时数字人引擎
- [Kokoro-82M](https://github.com/hexgrad/kokoro) — 本地 TTS
- [Ant Design](https://ant.design/) — UI 组件库

## License

Apache 2.0
