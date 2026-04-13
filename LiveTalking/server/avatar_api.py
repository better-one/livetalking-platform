"""
Avatar 管理 API — 创建、列表、进度查询、删除
"""
import os
import json
import glob
import shutil
import pickle
import threading
import time
import subprocess
import sys

from aiohttp import web
from utils.logger import logger

AVATAR_BASE = './data/avatars'
UPLOAD_DIR = './data/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 全局进度追踪
_progress = {}  # avatar_id -> {status, progress, message, ...}


def _run_generation(avatar_id: str, video_path: str, img_size: int):
    """在后台线程中运行 avatar 生成"""
    try:
        _progress[avatar_id] = {
            'status': 'processing',
            'progress': 0,
            'message': '开始处理 Starting...',
            'step': 'init',
        }

        avatar_path = os.path.join(AVATAR_BASE, avatar_id)
        full_imgs = os.path.join(avatar_path, 'full_imgs')
        face_imgs = os.path.join(avatar_path, 'face_imgs')
        os.makedirs(full_imgs, exist_ok=True)
        os.makedirs(face_imgs, exist_ok=True)

        # Step 1: 提取视频帧
        _progress[avatar_id].update({
            'progress': 10,
            'message': '提取视频帧 Extracting frames...',
            'step': 'extract_frames',
        })

        import cv2
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        max_frames = min(total_frames, 150)
        count = 0
        while count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            cv2.putText(frame, "LiveTalking", (10, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.3, (128, 128, 128), 1)
            cv2.imwrite(os.path.join(full_imgs, f'{count:08d}.png'), frame)
            count += 1
            pct = 10 + int((count / max_frames) * 20)
            _progress[avatar_id]['progress'] = pct
        cap.release()

        _progress[avatar_id].update({
            'progress': 30,
            'message': f'帧提取完成 {count} frames extracted, 开始人脸检测...',
            'step': 'face_detect',
            'total_frames': count,
            'resolution': f'{width}x{height}',
            'fps': fps,
        })

        # Step 2: 人脸检测
        import torch
        import numpy as np
        sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
        from avatars.wav2lip import face_detection

        input_img_list = sorted(glob.glob(os.path.join(full_imgs, '*.png')))
        frames = []
        for p in input_img_list:
            frames.append(cv2.imread(p))

        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        detector = face_detection.FaceAlignment(
            face_detection.LandmarksType._2D, flip_input=False, device=device)

        batch_size = 4
        predictions = []
        total_batches = (len(frames) + batch_size - 1) // batch_size
        for i in range(0, len(frames), batch_size):
            batch = np.array(frames[i:i + batch_size])
            predictions.extend(detector.get_detections_for_batch(batch))
            done_batches = i // batch_size + 1
            pct = 30 + int((done_batches / total_batches) * 50)
            _progress[avatar_id].update({
                'progress': pct,
                'message': f'人脸检测 Face detection {done_batches}/{total_batches}',
            })

        del detector
        torch.cuda.empty_cache()

        _progress[avatar_id].update({
            'progress': 80,
            'message': '裁剪人脸 Cropping faces...',
            'step': 'crop_faces',
        })

        # Step 3: 裁剪和保存
        pady1, pady2, padx1, padx2 = 0, 10, 0, 0
        results = []
        for rect, image in zip(predictions, frames):
            if rect is None:
                if results:
                    results.append(results[-1])
                else:
                    raise ValueError('First frame has no face')
                continue
            y1 = max(0, rect[1] - pady1)
            y2 = min(image.shape[0], rect[3] + pady2)
            x1 = max(0, rect[0] - padx1)
            x2 = min(image.shape[1], rect[2] + padx2)
            results.append([x1, y1, x2, y2])

        # Smooth
        boxes = np.array(results)
        T = 5
        for i in range(len(boxes)):
            window = boxes[max(0, i - T // 2):min(len(boxes), i + T // 2 + 1)]
            boxes[i] = np.mean(window, axis=0)

        coord_list = []
        for idx, (box, frame) in enumerate(zip(boxes, frames)):
            x1, y1, x2, y2 = [int(v) for v in box]
            face = frame[y1:y2, x1:x2]
            if face.size == 0:
                continue
            resized = cv2.resize(face, (img_size, img_size))
            cv2.imwrite(os.path.join(face_imgs, f'{idx:08d}.png'), resized)
            coord_list.append((y1, y2, x1, x2))

            pct = 80 + int(((idx + 1) / len(frames)) * 15)
            _progress[avatar_id]['progress'] = pct

        coords_path = os.path.join(avatar_path, 'coords.pkl')
        with open(coords_path, 'wb') as f:
            pickle.dump(coord_list, f)

        _progress[avatar_id].update({
            'status': 'ready',
            'progress': 100,
            'message': f'完成 Done! {len(coord_list)} frames',
            'step': 'done',
            'face_count': len(coord_list),
        })
        logger.info(f'Avatar {avatar_id} generated: {len(coord_list)} frames')

    except Exception as e:
        logger.exception(f'Avatar generation failed: {avatar_id}')
        _progress[avatar_id] = {
            'status': 'error',
            'progress': 0,
            'message': f'失败 Error: {str(e)}',
            'step': 'error',
        }
        # Cleanup on error
        avatar_path = os.path.join(AVATAR_BASE, avatar_id)
        if os.path.exists(avatar_path):
            shutil.rmtree(avatar_path, ignore_errors=True)


async def avatar_list(request):
    """获取所有 avatar 列表"""
    try:
        avatars = []
        if not os.path.exists(AVATAR_BASE):
            return web.json_response({'code': 0, 'data': []})

        for name in sorted(os.listdir(AVATAR_BASE)):
            path = os.path.join(AVATAR_BASE, name)
            if not os.path.isdir(path):
                continue

            face_dir = os.path.join(path, 'face_imgs')
            coords_file = os.path.join(path, 'coords.pkl')
            frames = len(glob.glob(os.path.join(face_dir, '*.png'))) if os.path.exists(face_dir) else 0
            has_coords = os.path.exists(coords_file)

            # Check if generating
            prog = _progress.get(name, {})
            if prog.get('status') == 'processing':
                status = 'generating'
            elif frames > 0 and has_coords:
                status = 'ready'
            else:
                status = 'error'

            # Get size
            total_size = 0
            for root, dirs, files in os.walk(path):
                total_size += sum(os.path.getsize(os.path.join(root, f)) for f in files)
            size_mb = round(total_size / 1024 / 1024, 1)

            # Detect resolution from first frame
            resolution = prog.get('resolution', '')
            orientation = 'landscape'
            if not resolution:
                first_frame = os.path.join(path, 'full_imgs', '00000000.png')
                if os.path.exists(first_frame):
                    import cv2
                    img = cv2.imread(first_frame)
                    if img is not None:
                        fh, fw = img.shape[:2]
                        resolution = f'{fw}x{fh}'
                        orientation = 'portrait' if fh > fw else 'landscape'

            avatars.append({
                'id': name,
                'frames': frames,
                'status': status,
                'size': f'{size_mb} MB',
                'progress': prog.get('progress', 100 if status == 'ready' else 0),
                'message': prog.get('message', ''),
                'resolution': resolution,
                'orientation': orientation,
            })

        return web.json_response({'code': 0, 'data': avatars})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def avatar_create(request):
    """上传视频并创建 avatar"""
    try:
        reader = await request.multipart()

        avatar_id = None
        img_size = 256
        video_path = None

        while True:
            part = await reader.next()
            if part is None:
                break

            if part.name == 'avatar_id':
                avatar_id = (await part.text()).strip()
            elif part.name == 'img_size':
                img_size = int((await part.text()).strip())
            elif part.name == 'video':
                filename = part.filename or 'upload.mp4'
                video_path = os.path.join(UPLOAD_DIR, f'{avatar_id or "temp"}_{filename}')
                with open(video_path, 'wb') as f:
                    while True:
                        chunk = await part.read_chunk()
                        if not chunk:
                            break
                        f.write(chunk)

        if not avatar_id:
            return web.json_response({'code': -1, 'msg': 'avatar_id required'})
        if not video_path or not os.path.exists(video_path):
            return web.json_response({'code': -1, 'msg': 'video file required'})

        # Check if already exists
        avatar_path = os.path.join(AVATAR_BASE, avatar_id)
        if os.path.exists(avatar_path):
            return web.json_response({'code': -1, 'msg': f'Avatar {avatar_id} already exists'})

        # Start generation in background
        thread = threading.Thread(
            target=_run_generation,
            args=(avatar_id, video_path, img_size),
            daemon=True,
        )
        thread.start()

        return web.json_response({
            'code': 0,
            'msg': 'Avatar generation started',
            'data': {'avatar_id': avatar_id},
        })

    except Exception as e:
        logger.exception('avatar_create error')
        return web.json_response({'code': -1, 'msg': str(e)})


async def avatar_progress(request):
    """查询 avatar 生成进度"""
    try:
        params = await request.json()
        avatar_id = params.get('avatar_id', '')

        if avatar_id in _progress:
            return web.json_response({'code': 0, 'data': _progress[avatar_id]})

        # Check if already done
        avatar_path = os.path.join(AVATAR_BASE, avatar_id)
        if os.path.exists(os.path.join(avatar_path, 'coords.pkl')):
            return web.json_response({'code': 0, 'data': {
                'status': 'ready', 'progress': 100, 'message': 'Ready',
            }})

        return web.json_response({'code': -1, 'msg': 'Avatar not found'})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


async def avatar_delete(request):
    """删除 avatar"""
    try:
        params = await request.json()
        avatar_id = params.get('avatar_id', '')

        avatar_path = os.path.join(AVATAR_BASE, avatar_id)
        if os.path.exists(avatar_path):
            shutil.rmtree(avatar_path)
            _progress.pop(avatar_id, None)
            return web.json_response({'code': 0, 'msg': 'Deleted'})
        return web.json_response({'code': -1, 'msg': 'Not found'})
    except Exception as e:
        return web.json_response({'code': -1, 'msg': str(e)})


def setup_avatar_routes(app):
    """注册 avatar API 路由"""
    app.router.add_get('/avatar/list', avatar_list)
    app.router.add_post('/avatar/create', avatar_create)
    app.router.add_post('/avatar/progress', avatar_progress)
    app.router.add_post('/avatar/delete', avatar_delete)
