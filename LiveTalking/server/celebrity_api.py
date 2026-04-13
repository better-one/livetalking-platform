"""
名人聊天 API — 名人列表、角色化对话、自动生成 avatar
"""
import os
import json
import asyncio
import threading
from aiohttp import web
from utils.logger import logger

CELEBRITY_DIR = './data/celebrities'
AVATAR_BASE = './data/avatars'
os.makedirs(CELEBRITY_DIR, exist_ok=True)

# 预置名人数据
PRESET_CELEBRITIES = {
    "einstein": {
        "id": "einstein",
        "name": "爱因斯坦",
        "nameEn": "Albert Einstein",
        "title": "理论物理学家",
        "titleEn": "Theoretical Physicist",
        "era": "1879-1955",
        "color": "#1677ff",
        "avatar_id": "celebrity_einstein",
        "greeting": "你好！我是阿尔伯特·爱因斯坦。想象力比知识更重要，因为知识是有限的，而想象力概括着世界的一切。你有什么问题想问我吗？",
        "system_prompt": """你现在扮演阿尔伯特·爱因斯坦（Albert Einstein），伟大的理论物理学家。

## 你的身份
- 姓名：阿尔伯特·爱因斯坦
- 生卒：1879年3月14日 - 1955年4月18日
- 国籍：德国/瑞士/美国
- 成就：狭义相对论、广义相对论、质能方程 E=mc²、光电效应（1921年诺贝尔物理学奖）

## 你的性格和说话风格
- 思维深邃但善于用通俗比喻解释复杂概念
- 幽默风趣，经常用日常例子解释物理学原理
- 热爱音乐（小提琴）、哲学思考
- 谦逊但对科学充满激情
- 喜欢用"想象一下..."开头来引导思考
- 经常引用自己的名言

## 你的标志性语录
- "想象力比知识更重要"
- "上帝不掷骰子"
- "一切都应该尽可能简单，但不要过于简单"
- "逻辑会把你从A带到B，想象力会把你带到任何地方"

## 对话规则
- 用第一人称"我"来说话
- 回答要有爱因斯坦的智慧和幽默感
- 对科学问题给出深入但通俗的解释
- 可以分享你在专利局、普林斯顿的故事
- 回答控制在100字以内，简洁有力
- 用中文回答，偶尔可以夹带英文或德文"""
    },
    "stalin": {
        "id": "stalin",
        "name": "斯大林",
        "nameEn": "Joseph Stalin",
        "title": "苏联领导人",
        "titleEn": "Soviet Leader",
        "era": "1878-1953",
        "color": "#ff4d4f",
        "avatar_id": "celebrity_stalin",
        "greeting": "同志，你好。我是约瑟夫·斯大林，苏维埃社会主义共和国联盟的领导人。工业化和集体化是我们伟大祖国的未来。你想了解什么？",
        "system_prompt": """你现在扮演约瑟夫·斯大林（Joseph Stalin），苏联领导人。

## 你的身份
- 姓名：约瑟夫·维萨里奥诺维奇·斯大林
- 生卒：1878年12月18日 - 1953年3月5日
- 国籍：苏联/格鲁吉亚
- 职务：苏联共产党中央委员会总书记（1922-1953）

## 你的性格和说话风格
- 说话沉稳、权威、简洁有力
- 喜欢用"同志"称呼他人
- 强调集体主义、工业化、国家力量
- 对苏联的成就充满自豪
- 偶尔引用马克思列宁主义理论
- 喜欢用反问来回应质疑

## 你的标志性语录
- "一个人的死亡是悲剧，一百万人的死亡是统计数据"
- "教育是一种武器，其效果取决于谁掌握它"
- "思想比武器更有力量"

## 对话规则
- 用第一人称"我"说话
- 保持斯大林式的威严和权威感
- 谈论苏联工业化、二战胜利等历史事件
- 回答控制在100字以内
- 用中文回答"""
    }
}


def _get_all_celebrities():
    """获取所有名人（预置+自定义）"""
    celebrities = dict(PRESET_CELEBRITIES)
    # Load custom celebrities from disk
    if os.path.exists(CELEBRITY_DIR):
        for f in os.listdir(CELEBRITY_DIR):
            if f.endswith('.json'):
                try:
                    with open(os.path.join(CELEBRITY_DIR, f), 'r', encoding='utf-8') as fh:
                        data = json.load(fh)
                        celebrities[data['id']] = data
                except:
                    pass
    return celebrities


async def celebrity_list(request):
    """获取名人列表"""
    try:
        celebrities = _get_all_celebrities()
        result = []
        for c in celebrities.values():
            # Check if avatar exists
            avatar_path = os.path.join(AVATAR_BASE, c.get('avatar_id', ''))
            has_avatar = os.path.exists(os.path.join(avatar_path, 'coords.pkl')) if avatar_path else False
            result.append({
                'id': c['id'],
                'name': c['name'],
                'nameEn': c.get('nameEn', ''),
                'title': c.get('title', ''),
                'titleEn': c.get('titleEn', ''),
                'era': c.get('era', ''),
                'color': c.get('color', '#1677ff'),
                'avatar_id': c.get('avatar_id', ''),
                'has_avatar': has_avatar,
                'greeting': c.get('greeting', ''),
            })
        return web.json_response({'code': 0, 'data': result})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def celebrity_chat(request):
    """名人角色化对话 — 将 system_prompt 注入 LLM"""
    try:
        params = await request.json()
        celebrity_id = params.get('celebrity_id', '')
        user_text = params.get('text', '')
        sessionid = params.get('sessionid', '')

        celebrities = _get_all_celebrities()
        celeb = celebrities.get(celebrity_id)
        if not celeb:
            return web.json_response({'code': -1, 'msg': 'Celebrity not found'})

        from server.session_manager import session_manager
        avatar_session = session_manager.get_session(sessionid)
        if avatar_session is None:
            return web.json_response({'code': -1, 'msg': 'Session not found'})

        system_prompt = celeb.get('system_prompt', '')

        # Use LLM with celebrity persona
        llm_response = request.app.get("llm_response")
        if llm_response:
            asyncio.get_event_loop().run_in_executor(
                None, llm_response, user_text, avatar_session,
                {'system_prompt': system_prompt}
            )
            return web.json_response({'code': 0, 'msg': 'Chat started'})
        else:
            # Fallback: echo greeting or simple response
            avatar_session.put_msg_txt(
                f"我是{celeb['name']}。{user_text}这是个很好的问题！让我想想...", {})
            return web.json_response({'code': 0, 'msg': 'Echo fallback'})

    except Exception as e:
        logger.exception('celebrity_chat error')
        return web.json_response({'code': -1, 'msg': str(e)})


async def celebrity_add(request):
    """添加自定义名人"""
    try:
        params = await request.json()
        cid = params.get('id', '').strip()
        if not cid:
            return web.json_response({'code': -1, 'msg': 'id required'})

        data = {
            'id': cid,
            'name': params.get('name', cid),
            'nameEn': params.get('nameEn', ''),
            'title': params.get('title', ''),
            'titleEn': params.get('titleEn', ''),
            'era': params.get('era', ''),
            'color': params.get('color', '#1677ff'),
            'avatar_id': params.get('avatar_id', f'celebrity_{cid}'),
            'greeting': params.get('greeting', f'你好，我是{params.get("name", cid)}。'),
            'system_prompt': params.get('system_prompt', ''),
        }

        path = os.path.join(CELEBRITY_DIR, f'{cid}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return web.json_response({'code': 0, 'msg': 'Celebrity added'})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def celebrity_detail(request):
    """获取名人详情（含 system_prompt）"""
    try:
        params = await request.json()
        cid = params.get('celebrity_id', '')
        celebrities = _get_all_celebrities()
        celeb = celebrities.get(cid)
        if not celeb:
            return web.json_response({'code': -1, 'msg': 'Not found'})
        return web.json_response({'code': 0, 'data': celeb})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


def setup_celebrity_routes(app):
    """注册名人聊天 API"""
    app.router.add_get('/celebrity/list', celebrity_list)
    app.router.add_post('/celebrity/chat', celebrity_chat)
    app.router.add_post('/celebrity/add', celebrity_add)
    app.router.add_post('/celebrity/detail', celebrity_detail)
