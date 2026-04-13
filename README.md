<p align="center">
  <h1 align="center">LiveTalking 数字人平台</h1>
  <h3 align="center">Real-time Digital Human Platform</h3>
  <p align="center">
    <a href="#中文介绍">🇨🇳 中文</a> | <a href="#english">🇺🇸 English</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/python-3.10+-blue" />
    <img src="https://img.shields.io/badge/react-18-61dafb" />
    <img src="https://img.shields.io/badge/antd-5-1677ff" />
    <img src="https://img.shields.io/badge/license-Apache%202.0-green" />
    <img src="https://img.shields.io/badge/tests-115%20passed-brightgreen" />
  </p>
</p>

---

<a id="中文介绍"></a>

## 🇨🇳 中文介绍

基于 [LiveTalking](https://github.com/lipku/LiveTalking) 的实时交互数字人平台，提供完整 Web UI、名人聊天、多引擎支持。

### 功能亮点

- **实时数字人** — Wav2Lip 驱动口型，25fps 实时渲染，WebRTC 推流
- **名人聊天** — 沉浸式全屏对话，预置爱因斯坦/斯大林，支持自定义名人
- **语音输入** — 浏览器端 ASR（Web Speech API），按 Space 键说话
- **8 种 TTS 引擎** — Kokoro 本地低延迟(175ms) / EdgeTTS / GPT-SoVITS / CosyVoice 等
- **5 种 LLM** — 通义千问 / OpenAI / DeepSeek / Ollama(本地) / 自定义
- **形象管理** — 上传视频自动生成数字人形象，实时进度追踪
- **视频录制** — 录制数字人视频，下载管理
- **动作编排** — 空闲/回复/思考/离开 4 种状态切换

### 页面展示

#### 工作台
> 实时预览数字人、文本/音频驱动、录制、TTS/模型选择

![工作台](assets/workbench.png)

#### 形象管理
> 上传视频生成形象、实时进度、人脸裁剪预览、搜索过滤

![形象管理](assets/avatars.png)

#### 名人聊天
> 沉浸式全屏，AI 角色对话，语音输入，悬停显示 UI

![名人聊天](assets/celebrity-chat.png)

#### 视频列表
> 录制视频管理、筛选排序、批量操作、预览下载

![视频列表](assets/videos.png)

#### 设置
> 服务器/TTS/LLM/系统配置、GPU 信息、测试连接

![设置](assets/settings.png)

### 快速开始

#### 环境要求

| 项目 | 要求 |
|------|------|
| Python | 3.10+ |
| CUDA | 12.0+ |
| GPU 显存 | 4GB+ |
| Node.js | 18+ |

#### 1. 安装后端

```bash
cd LiveTalking
python -m venv venv
source venv/Scripts/activate  # Windows
pip install torch==2.5.0 torchaudio==2.5.0 torchvision==0.20.0 \
    --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
pip install kokoro soundfile ordered-set "misaki[zh]"
```

#### 2. 下载模型

从 [夸克网盘](https://pan.quark.cn/s/83a750323ef0) 或 [Google Drive](https://drive.google.com/drive/folders/1FOC_MD6wdogyyX_7V1d4NDIO7P9NlSAJ) 下载：

- `wav2lip256.pth` → 重命名为 `wav2lip.pth` 放到 `models/`
- `wav2lip256_avatar1.tar.gz` → 解压到 `data/avatars/`

#### 3. 生成自定义形象

```bash
PYTHONPATH=. python avatars/wav2lip/genavatar.py \
    --video_path your_video.mp4 --avatar_id your_avatar \
    --img_size 256 --face_det_batch_size 4
```

#### 4. 启动后端

```bash
python app.py --transport webrtc --model wav2lip \
    --avatar_id your_avatar --modelres 256 --tts kokoro
```

#### 5. 启动前端

```bash
cd livetalking-ui
npm install
npx vite --port 3000
```

打开 http://localhost:3000

### LLM 配置

| 厂商 | 模型 | 配置方式 |
|------|------|----------|
| 通义千问 | qwen-plus / qwen-turbo | `export DASHSCOPE_API_KEY=sk-xxx` |
| OpenAI | gpt-4o / gpt-4o-mini | `export OPENAI_API_KEY=sk-xxx` |
| DeepSeek | deepseek-chat | `export DEEPSEEK_API_KEY=sk-xxx` |
| Ollama | qwen2.5:7b / llama3:8b | 无需 Key，本地运行 |
| 自定义 | 任意 OpenAI 兼容 | 设置页面填写 |

### 性能指标

| 指标 | 数值 | 说明 |
|------|------|------|
| Wav2Lip 推理 | **65 fps** | 远超实时 |
| 视频输出 | **25 fps** | 稳定达标 |
| Kokoro TTS 延迟 | **175 ms** | 本地推理 |
| EdgeTTS 延迟 | ~2,400 ms | 在线服务 |
| TTS 加速比 | **14x** | Kokoro vs EdgeTTS |
| GPU 显存 | ~2.3 GB | RTX 4060 |

---

<a id="english"></a>

## 🇺🇸 English

A full-featured real-time digital human platform based on [LiveTalking](https://github.com/lipku/LiveTalking), with complete Web UI, celebrity chat, and multi-engine support.

### Features

- **Real-time Avatar** — Wav2Lip driven lip-sync, 25fps rendering, WebRTC streaming
- **Celebrity Chat** — Immersive full-screen AI persona dialogue with Einstein/Stalin presets
- **Voice Input** — Browser ASR (Web Speech API), press Space to talk
- **8 TTS Engines** — Kokoro local 175ms / EdgeTTS / GPT-SoVITS / CosyVoice etc.
- **5 LLM Providers** — Qwen / OpenAI / DeepSeek / Ollama (local) / Custom
- **Avatar Management** — Upload video to auto-generate digital human with progress tracking
- **Video Recording** — Record, preview, and download avatar videos
- **Action Choreography** — Idle / Reply / Think / Leave state switching

### Screenshots

#### Workbench
> Live preview, text/audio driven, recording, TTS/model selection

![Workbench](assets/workbench.png)

#### Avatar Management
> Upload video to generate avatar, real-time progress, face-crop preview, search

![Avatars](assets/avatars.png)

#### Celebrity Chat
> Immersive full-screen, AI persona chat, voice input, hover to reveal UI

![Celebrity Chat](assets/celebrity-chat.png)

#### Video Library
> Recorded video management, filter/sort, batch operations, preview/download

![Videos](assets/videos.png)

#### Settings
> Server/TTS/LLM/System config, GPU info, test connection

![Settings](assets/settings.png)

### Quick Start

#### Requirements

| Item | Requirement |
|------|-------------|
| Python | 3.10+ |
| CUDA | 12.0+ |
| GPU VRAM | 4GB+ |
| Node.js | 18+ |

#### 1. Install Backend

```bash
cd LiveTalking
python -m venv venv
source venv/Scripts/activate  # Windows
# source venv/bin/activate    # Linux/Mac
pip install torch==2.5.0 torchaudio==2.5.0 torchvision==0.20.0 \
    --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
pip install kokoro soundfile ordered-set "misaki[zh]"
```

#### 2. Download Models

From [Quark Drive](https://pan.quark.cn/s/83a750323ef0) or [Google Drive](https://drive.google.com/drive/folders/1FOC_MD6wdogyyX_7V1d4NDIO7P9NlSAJ):

- `wav2lip256.pth` → rename to `wav2lip.pth` → `models/`
- `wav2lip256_avatar1.tar.gz` → extract to `data/avatars/`

#### 3. Generate Custom Avatar

```bash
PYTHONPATH=. python avatars/wav2lip/genavatar.py \
    --video_path your_video.mp4 --avatar_id your_avatar \
    --img_size 256 --face_det_batch_size 4
```

#### 4. Start Backend

```bash
python app.py --transport webrtc --model wav2lip \
    --avatar_id your_avatar --modelres 256 --tts kokoro
```

#### 5. Start Frontend

```bash
cd livetalking-ui
npm install
npx vite --port 3000
```

Open http://localhost:3000

### LLM Configuration

| Provider | Models | Setup |
|----------|--------|-------|
| Qwen | qwen-plus / qwen-turbo | `export DASHSCOPE_API_KEY=sk-xxx` |
| OpenAI | gpt-4o / gpt-4o-mini | `export OPENAI_API_KEY=sk-xxx` |
| DeepSeek | deepseek-chat | `export DEEPSEEK_API_KEY=sk-xxx` |
| Ollama | qwen2.5:7b / llama3:8b | No key needed, runs locally |
| Custom | Any OpenAI-compatible | Fill in Settings page |

### Performance

| Metric | Value | Note |
|--------|-------|------|
| Wav2Lip Inference | **65 fps** | Well above real-time |
| Video Output | **25 fps** | Stable |
| Kokoro TTS Latency | **175 ms** | Local inference |
| EdgeTTS Latency | ~2,400 ms | Online service |
| TTS Speedup | **14x** | Kokoro vs EdgeTTS |
| GPU VRAM | ~2.3 GB | RTX 4060 Laptop |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser 浏览器                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │Workbench │  │ Avatars  │  │Celebrity │  │Settings │ │
│  │ 工作台    │  │ 形象管理  │  │ 名人聊天  │  │ 设置    │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       └──────────────┴─────────────┴──────────────┘      │
│         Hooks: useWebRTC / useSpeaking / useASR          │
│         API Layer: api.ts                                │
└─────────────────────────┬────────────────────────────────┘
                          │ WebRTC + REST API
┌─────────────────────────┼────────────────────────────────┐
│                  Backend 后端 (:8010)                     │
│  ┌───────┐  ┌─────┐  ┌─────────┐  ┌───────────┐        │
│  │Wav2Lip│  │ TTS │  │   LLM   │  │  Avatar   │        │
│  │ 65fps │  │175ms│  │Qwen/GPT │  │  Manager  │        │
│  └───────┘  └─────┘  └─────────┘  └───────────┘        │
└──────────────────────────────────────────────────────────┘
```

## Project Structure

```
├── LiveTalking/                  # Backend
│   ├── app.py                    # Main entry
│   ├── llm.py                    # Multi-provider LLM
│   ├── server/
│   │   ├── avatar_api.py         # Avatar CRUD + progress
│   │   ├── celebrity_api.py      # Celebrity persona chat
│   │   ├── system_api.py         # GPU info + video list
│   │   └── llm_api.py            # LLM config API
│   └── tts/
│       └── kokoro_tts.py         # Local TTS (175ms)
│
├── livetalking-ui/               # Frontend
│   └── src/
│       ├── App.tsx               # Router + Workbench
│       ├── hooks/                # useWebRTC, useSpeaking, useASR
│       ├── services/api.ts       # Unified API layer
│       └── pages/                # 5 pages
│
├── assets/                       # Screenshots
└── TEST_REPORT.md                # 115/115 tests passed
```

## Acknowledgments

- [LiveTalking](https://github.com/lipku/LiveTalking) — Real-time digital human engine
- [Kokoro-82M](https://github.com/hexgrad/kokoro) — Local TTS engine
- [Ant Design](https://ant.design/) — UI component library

## License

Apache 2.0
