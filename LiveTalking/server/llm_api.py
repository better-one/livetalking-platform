"""
LLM 配置管理 API
"""
from aiohttp import web
from utils.logger import logger
from llm import get_llm_config, set_llm_config, PROVIDER_PRESETS


async def llm_get_config(request):
    """获取 LLM 配置"""
    try:
        config = get_llm_config()
        # Mask API key
        if config.get('api_key'):
            key = config['api_key']
            config['api_key_masked'] = key[:6] + '***' + key[-4:] if len(key) > 10 else '***'
        else:
            config['api_key_masked'] = ''
        config['providers'] = {k: {'models': v['models'], 'base_url': v['base_url']} for k, v in PROVIDER_PRESETS.items()}
        return web.json_response({'code': 0, 'data': config})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def llm_set_config(request):
    """更新 LLM 配置"""
    try:
        params = await request.json()
        set_llm_config(params)
        return web.json_response({'code': 0, 'msg': 'LLM config updated'})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def llm_test(request):
    """测试 LLM 连接"""
    try:
        from openai import OpenAI
        config = get_llm_config()
        api_key = config.get('api_key') or 'ollama'
        client = OpenAI(api_key=api_key, base_url=config.get('base_url'))
        resp = client.chat.completions.create(
            model=config.get('model'),
            messages=[{'role': 'user', 'content': '说"连接成功"'}],
            max_tokens=20,
        )
        reply = resp.choices[0].message.content
        return web.json_response({'code': 0, 'data': {'reply': reply}})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


def setup_llm_routes(app):
    app.router.add_get('/llm/config', llm_get_config)
    app.router.add_post('/llm/config', llm_set_config)
    app.router.add_post('/llm/test', llm_test)
