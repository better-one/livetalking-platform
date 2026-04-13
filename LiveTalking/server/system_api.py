"""
系统信息 + 视频列表 API
"""
import os
import glob
import json
import subprocess
from aiohttp import web
from utils.logger import logger

RECORD_DIR = './data/records'
AVATAR_BASE = './data/avatars'


async def system_info(request):
    """返回 GPU、Python、PyTorch 等系统信息"""
    try:
        info = {
            'python': '',
            'pytorch': '',
            'cuda_available': False,
            'cuda_version': '',
            'gpu_name': '',
            'gpu_memory_total': '',
            'gpu_memory_used': '',
            'driver_version': '',
        }

        import torch
        info['pytorch'] = torch.__version__
        info['cuda_available'] = torch.cuda.is_available()

        import sys
        info['python'] = f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}'

        if torch.cuda.is_available():
            info['gpu_name'] = torch.cuda.get_device_name(0)
            mem = torch.cuda.get_device_properties(0).total_memory
            info['gpu_memory_total'] = f'{mem / 1024**3:.1f} GB'
            used = torch.cuda.memory_allocated(0)
            info['gpu_memory_used'] = f'{used / 1024**3:.1f} GB'

        # Get CUDA version and driver from nvidia-smi
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=driver_version,memory.used,memory.total', '--format=csv,noheader,nounits'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                parts = result.stdout.strip().split(', ')
                if len(parts) >= 3:
                    info['driver_version'] = parts[0]
                    info['gpu_memory_used'] = f'{float(parts[1])/1024:.1f} GB'
                    info['gpu_memory_total'] = f'{float(parts[2])/1024:.1f} GB'
        except:
            pass

        try:
            result = subprocess.run(['nvcc', '--version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'release' in line:
                        info['cuda_version'] = line.split('release')[1].split(',')[0].strip()
        except:
            pass

        return web.json_response({'code': 0, 'data': info})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def video_list(request):
    """返回录制的视频列表"""
    try:
        videos = []

        # Scan record files
        if os.path.exists(RECORD_DIR):
            for f in sorted(os.listdir(RECORD_DIR), reverse=True):
                if f.endswith(('.mp4', '.avi', '.mkv')):
                    path = os.path.join(RECORD_DIR, f)
                    size = os.path.getsize(path)
                    mtime = os.path.getmtime(path)
                    import datetime
                    created = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M')

                    # Try to get video info
                    duration = '-'
                    resolution = '-'
                    try:
                        import cv2
                        cap = cv2.VideoCapture(path)
                        if cap.isOpened():
                            fps = cap.get(cv2.CAP_PROP_FPS)
                            frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                            if fps > 0 and frames > 0:
                                secs = int(frames / fps)
                                duration = f'{secs // 60:02d}:{secs % 60:02d}'
                            resolution = f'{w}x{h}'
                        cap.release()
                    except:
                        pass

                    videos.append({
                        'key': f,
                        'name': f,
                        'duration': duration,
                        'resolution': resolution,
                        'size': f'{size / 1024 / 1024:.1f} MB',
                        'status': 'completed',
                        'progress': 100,
                        'createdAt': created,
                    })

        return web.json_response({'code': 0, 'data': videos})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def video_delete(request):
    """删除录制的视频"""
    try:
        params = await request.json()
        filename = params.get('filename', '')

        path = os.path.join(RECORD_DIR, filename)
        if os.path.exists(path):
            os.remove(path)
            return web.json_response({'code': 0, 'msg': 'Deleted'})
        return web.json_response({'code': -1, 'msg': 'File not found'})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def avatar_preview(request):
    """返回 avatar 的人脸裁剪预览图，适配横屏和竖屏"""
    import cv2
    import pickle

    avatar_id = request.match_info.get('avatar_id', '')
    avatar_path = os.path.join(AVATAR_BASE, avatar_id)
    img_path = os.path.join(avatar_path, 'full_imgs', '00000000.png')
    coords_path = os.path.join(avatar_path, 'coords.pkl')

    if not os.path.exists(img_path):
        return web.Response(status=404, text='Not found')

    try:
        img = cv2.imread(img_path)
        h, w = img.shape[:2]
        is_portrait = h > w  # 竖屏

        if os.path.exists(coords_path):
            with open(coords_path, 'rb') as f:
                coords = pickle.load(f)
            if coords:
                y1, y2, x1, x2 = coords[0]
                face_h = y2 - y1
                face_w = x2 - x1
                face_cx = (x1 + x2) // 2
                face_cy = (y1 + y2) // 2

                # Target: 3:4 crop (portrait card friendly)
                # Crop size based on face size with generous padding
                crop_size = int(max(face_h, face_w) * 2.5)
                crop_w_half = int(crop_size * 0.5)  # width
                crop_h_half = int(crop_size * 0.67)  # height (3:4 ratio)

                # Center on face, shift up slightly to show more forehead
                cy = face_cy - int(face_h * 0.1)

                cy1 = max(0, cy - crop_h_half)
                cy2 = min(h, cy + crop_h_half)
                cx1 = max(0, face_cx - crop_w_half)
                cx2 = min(w, face_cx + crop_w_half)

                # If crop hits edges, shift to stay within bounds
                if cy1 == 0:
                    cy2 = min(h, crop_h_half * 2)
                if cy2 == h:
                    cy1 = max(0, h - crop_h_half * 2)
                if cx1 == 0:
                    cx2 = min(w, crop_w_half * 2)
                if cx2 == w:
                    cx1 = max(0, w - crop_w_half * 2)

                img = img[cy1:cy2, cx1:cx2]

        # Resize to 300x400 (3:4) for consistent card display
        if img.shape[0] > 0 and img.shape[1] > 0:
            img = cv2.resize(img, (300, 400))

        _, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return web.Response(body=buf.tobytes(), content_type='image/jpeg')
    except Exception as e:
        return web.FileResponse(img_path)


def setup_system_routes(app):
    """注册系统 API 路由"""
    app.router.add_get('/system/info', system_info)
    app.router.add_get('/video/list', video_list)
    app.router.add_post('/video/delete', video_delete)
    app.router.add_get('/avatar/preview/{avatar_id}', avatar_preview)
