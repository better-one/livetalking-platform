import time
import os
import json
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from avatars.base_avatar import BaseAvatar
from utils.logger import logger

# LLM 配置（可通过 /llm/config API 动态修改）
_llm_config = {
    'provider': os.getenv('LLM_PROVIDER', 'qwen'),   # qwen / openai / ollama / custom
    'api_key': os.getenv('DASHSCOPE_API_KEY', ''),
    'base_url': os.getenv('LLM_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    'model': os.getenv('LLM_MODEL', 'qwen-plus'),
    'system_prompt': '你是一个知识助手，尽量以简短、口语化的方式输出',
    'max_tokens': 500,
    'temperature': 0.7,
}

# Provider 预设
PROVIDER_PRESETS = {
    'qwen': {
        'base_url': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        'models': ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
        'env_key': 'DASHSCOPE_API_KEY',
    },
    'openai': {
        'base_url': 'https://api.openai.com/v1',
        'models': ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
        'env_key': 'OPENAI_API_KEY',
    },
    'ollama': {
        'base_url': 'http://localhost:11434/v1',
        'models': ['qwen2.5:7b', 'llama3:8b', 'gemma2:9b'],
        'env_key': '',
    },
    'deepseek': {
        'base_url': 'https://api.deepseek.com/v1',
        'models': ['deepseek-chat', 'deepseek-reasoner'],
        'env_key': 'DEEPSEEK_API_KEY',
    },
    'custom': {
        'base_url': '',
        'models': [],
        'env_key': '',
    },
}


def get_llm_config():
    """获取当前 LLM 配置"""
    return dict(_llm_config)


def set_llm_config(config: dict):
    """更新 LLM 配置"""
    for k in ['provider', 'api_key', 'base_url', 'model', 'system_prompt', 'max_tokens', 'temperature']:
        if k in config:
            _llm_config[k] = config[k]

    # Auto-fill base_url from provider preset
    provider = _llm_config.get('provider', 'custom')
    if provider in PROVIDER_PRESETS and not config.get('base_url'):
        _llm_config['base_url'] = PROVIDER_PRESETS[provider]['base_url']

    # Auto-fill api_key from env
    if not _llm_config.get('api_key') and provider in PROVIDER_PRESETS:
        env_key = PROVIDER_PRESETS[provider]['env_key']
        if env_key:
            _llm_config['api_key'] = os.getenv(env_key, '')

    logger.info(f"LLM config updated: provider={_llm_config['provider']}, model={_llm_config['model']}, base_url={_llm_config['base_url'][:40]}...")


def llm_response(message, avatar_session: 'BaseAvatar', datainfo: dict = {}):
    try:
        start = time.perf_counter()
        from openai import OpenAI

        api_key = _llm_config.get('api_key') or 'ollama'  # ollama doesn't need key
        base_url = _llm_config.get('base_url')
        model = _llm_config.get('model')

        client = OpenAI(api_key=api_key, base_url=base_url)

        end = time.perf_counter()
        logger.info(f"llm init: {end-start:.2f}s, provider={_llm_config['provider']}, model={model}")

        # Build messages with system prompt
        # Priority: datainfo.system_prompt (celebrity persona) > _llm_config.system_prompt (default)
        system_prompt = datainfo.get('system_prompt', _llm_config.get('system_prompt', ''))
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': message},
        ]

        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            max_tokens=_llm_config.get('max_tokens', 500),
            temperature=_llm_config.get('temperature', 0.7),
            stream_options={"include_usage": True},
        )

        result = ""
        first = True
        for chunk in completion:
            if len(chunk.choices) > 0:
                if first:
                    end = time.perf_counter()
                    logger.info(f"llm first chunk: {end-start:.2f}s")
                    first = False
                msg = chunk.choices[0].delta.content
                if msg is None:
                    continue
                lastpos = 0
                for i, char in enumerate(msg):
                    if char in ",.!;:，。！？：；":
                        result = result + msg[lastpos:i+1]
                        lastpos = i + 1
                        if len(result) > 10:
                            logger.info(result)
                            avatar_session.put_msg_txt(result, datainfo)
                            result = ""
                result = result + msg[lastpos:]

        end = time.perf_counter()
        logger.info(f"llm done: {end-start:.2f}s")
        if result:
            avatar_session.put_msg_txt(result, datainfo)

    except Exception as e:
        logger.exception('llm exception:')
        # Fallback: echo error info
        avatar_session.put_msg_txt(f"抱歉，AI 暂时无法回答。错误：{str(e)[:50]}", datainfo)
