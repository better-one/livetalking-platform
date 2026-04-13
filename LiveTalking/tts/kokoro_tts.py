"""
Kokoro TTS 插件 — 本地低延迟中文语音合成
~200ms 延迟，替代 EdgeTTS 的 ~2400ms
"""
import time
import numpy as np
import resampy

from utils.logger import logger
from .base_tts import BaseTTS, State
from registry import register

_pipeline = None
_voice = None


def _get_pipeline():
    """懒加载 Kokoro pipeline（首次调用时初始化）"""
    global _pipeline, _voice
    if _pipeline is None:
        logger.info('Loading Kokoro TTS model...')
        t = time.time()
        try:
            from kokoro import KPipeline
            _pipeline = KPipeline(lang_code='z')  # 'z' = Chinese
            # 预热
            for result in _pipeline('测试', voice='zf_xiaobei', speed=1.0):
                pass
            logger.info(f'Kokoro TTS loaded in {time.time()-t:.1f}s')
        except Exception as e:
            logger.exception(f'Failed to load Kokoro TTS: {e}')
            _pipeline = None
    return _pipeline


@register("tts", "kokoro")
class KokoroTTS(BaseTTS):
    """Kokoro-82M 本地 TTS，低延迟中文语音合成"""

    VOICE_MAP = {
        # 中文女声
        'zf_xiaobei': 'zf_xiaobei',
        'zf_xiaoni': 'zf_xiaoni',
        'zf_xiaoxiao': 'zf_xiaoxiao',
        'zf_xiaoyi': 'zf_xiaoyi',
        # 中文男声
        'zm_yunyang': 'zm_yunyang',
        'zm_yunjian': 'zm_yunjian',
        # 兼容 EdgeTTS 音色名（自动映射）
        'zh-CN-YunxiaNeural': 'zf_xiaobei',
        'zh-CN-XiaoxiaoNeural': 'zf_xiaoxiao',
        'zh-CN-YunxiNeural': 'zm_yunyang',
        'zh-CN-YunyangNeural': 'zm_yunyang',
        'zh-CN-XiaoyiNeural': 'zf_xiaoyi',
    }

    def txt_to_audio(self, msg: tuple[str, dict]):
        text, textevent = msg
        t = time.time()

        pipeline = _get_pipeline()
        if pipeline is None:
            logger.error('Kokoro TTS not loaded, skipping')
            return

        # Resolve voice name
        voice_name = textevent.get('tts', {}).get('voice',
                     textevent.get('tts', {}).get('ref_file', self.opt.REF_FILE))
        voice = self.VOICE_MAP.get(voice_name, 'zf_xiaobei')

        try:
            # Generate audio
            audio_chunks = []
            for result in pipeline(text, voice=voice, speed=1.0):
                if result.audio is not None:
                    audio_np = result.audio.detach().cpu().numpy()
                    audio_chunks.append(audio_np)

            if not audio_chunks:
                logger.warning('Kokoro TTS returned no audio')
                return

            # Concatenate all chunks
            stream = np.concatenate(audio_chunks)
            kokoro_sr = 24000  # Kokoro outputs at 24kHz

            logger.info(f'-------kokoro tts time:{time.time()-t:.4f}s, samples={stream.shape[0]}')

            # Resample to 16kHz
            if kokoro_sr != self.sample_rate:
                stream = resampy.resample(x=stream, sr_orig=kokoro_sr, sr_new=self.sample_rate)

            stream = stream.astype(np.float32)

            # Push audio frames
            streamlen = stream.shape[0]
            idx = 0
            while streamlen >= self.chunk and self.state == State.RUNNING:
                eventpoint = {}
                streamlen -= self.chunk
                if idx == 0:
                    eventpoint = {'status': 'start', 'text': text}
                elif streamlen < self.chunk:
                    eventpoint = {'status': 'end', 'text': text}
                eventpoint.update(**textevent)
                self.parent.put_audio_frame(stream[idx:idx + self.chunk], eventpoint)
                idx += self.chunk

        except Exception as e:
            logger.exception(f'Kokoro TTS error: {e}')
