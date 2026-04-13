"""
批量下载视频并生成数字人Avatar
从Pexels下载人物正脸视频，自动检测人脸并生成Avatar数据
"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import os
import sys
import cv2
import numpy as np
import requests
import pickle
import torch
import time
from tqdm import tqdm
from glob import glob

sys.path.insert(0, os.path.dirname(__file__))

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
AVATAR_BASE = './data/avatars'
VIDEO_CACHE = './data/video_cache'
os.makedirs(VIDEO_CACHE, exist_ok=True)

# Pexels视频ID候选列表 - 人物正脸/肖像类
CANDIDATE_IDS = [
    # woman portrait/smiling
    5496767, 6706804, 5270720, 8048443, 3015510, 5926452,
    4625514, 4625517, 6010489, 5530286, 6953531, 4064347,
    5164017, 5164028, 4625507, 4625510, 3252638, 3252645,
    5981354, 6010553, 8720915, 8048537, 7914344, 7914350,
    4778930, 4778935, 4553186, 4158252, 3205014, 5164026,
    # more portrait videos
    5647015, 5647021, 5647025, 5647028, 5647036, 5647039,
    6010492, 6010495, 6010498, 6010501, 6010504, 6010507,
    5926455, 5926458, 5926461, 5926464, 5926467, 5926470,
    4625520, 4625523, 4625526, 4625529, 4625532, 4625535,
    8048440, 8048446, 8048449, 8048452, 8048455, 8048458,
    # business/professional
    7914347, 7914353, 7914356, 7914359, 7914362, 7914365,
    4778933, 4778938, 4778941, 4778944, 4778947, 4778950,
    # diverse portraits
    3252641, 3252647, 3252650, 3252653, 3252656, 3252659,
    5981357, 5981360, 5981363, 5981366, 5981369, 5981372,
    4553189, 4553192, 4553195, 4553198, 4553201, 4553204,
    4158255, 4158258, 4158261, 4158264, 4158267, 4158270,
    3205017, 3205020, 3205023, 3205026, 3205029, 3205032,
    # additional
    5164020, 5164023, 5164029, 5164032, 5164035, 5164038,
    4064350, 4064353, 4064356, 4064359, 4064362, 4064365,
    6953534, 6953537, 6953540, 6953543, 6953546, 6953549,
    8720918, 8720921, 8720924, 8720927, 8720930, 8720933,
    # more IDs to try
    5530289, 5530292, 5530295, 5530298, 5530301, 5530304,
    6010510, 6010513, 6010516, 6010519, 6010522, 6010525,
    # extra range
    5496770, 5496773, 5496776, 5496779, 5496782, 5496785,
    6706807, 6706810, 6706813, 6706816, 6706819, 6706822,
    5270723, 5270726, 5270729, 5270732, 5270735, 5270738,
    # popular portrait ranges
    4829649, 4829524, 4829541, 4829556, 4829567, 4829590,
    5199419, 5199420, 5199425, 5199435, 5199440, 5199445,
    6567743, 6567745, 6567750, 6567755, 6567760, 6567765,
    7641093, 7641095, 7641100, 7641105, 7641110, 7641115,
    # beauty/fashion
    3065094, 3065095, 3065096, 3065097, 3065098, 3065099,
    3914721, 3914722, 3914723, 3914724, 3914725, 3914726,
    4946385, 4946386, 4946387, 4946388, 4946389, 4946390,
    # studio portraits
    6474215, 6474216, 6474217, 6474218, 6474219, 6474220,
    7518667, 7518668, 7518669, 7518670, 7518671, 7518672,
    8192098, 8192099, 8192100, 8192101, 8192102, 8192103,
]

# 尝试的分辨率模式（优先SD，加快处理速度）
RES_PATTERNS = [
    'sd_540_960_25fps', 'sd_540_960_30fps',
    'sd_960_540_25fps', 'sd_960_540_30fps',
    'sd_540_960', 'sd_960_540',
    'hd_1080_1920_25fps', 'hd_1080_1920_30fps',
    'hd_1920_1080_25fps', 'hd_1920_1080_30fps',
    'hd_1080_1920', 'hd_1920_1080',
]


def try_download_video(video_id):
    """尝试从Pexels CDN下载视频"""
    for res in RES_PATTERNS:
        url = f'https://videos.pexels.com/video-files/{video_id}/{video_id}-{res}.mp4'
        try:
            r = requests.head(url, headers=HEADERS, timeout=8)
            size = int(r.headers.get('content-length', 0))
            if r.status_code == 200 and size > 100000:  # >100KB
                # Download
                save_path = os.path.join(VIDEO_CACHE, f'{video_id}.mp4')
                r = requests.get(url, headers=HEADERS, timeout=60, stream=True)
                with open(save_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                return save_path, res
        except:
            continue
    return None, None


def check_video_quality(video_path, min_width=400, min_height=400):
    """检查视频质量：分辨率、帧数、是否能检测到人脸"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return False, "Cannot open video"

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if w < min_width or h < min_height:
        cap.release()
        return False, f"Too small: {w}x{h}"

    if frames < 50:
        cap.release()
        return False, f"Too few frames: {frames}"

    cap.release()

    # 基本尺寸和帧数检查即可，人脸检测交给后续generate_avatar中的专业检测器
    return True, f"{w}x{h}, {fps:.0f}fps, {frames} frames"


def generate_avatar(video_path, avatar_id, img_size=256):
    """生成Avatar数据"""
    from avatars.wav2lip import face_detection

    avatar_path = os.path.join(AVATAR_BASE, avatar_id)
    full_imgs_path = os.path.join(avatar_path, 'full_imgs')
    face_imgs_path = os.path.join(avatar_path, 'face_imgs')
    coords_path = os.path.join(avatar_path, 'coords.pkl')

    os.makedirs(full_imgs_path, exist_ok=True)
    os.makedirs(face_imgs_path, exist_ok=True)

    # 提取视频帧（限制最多150帧，约6秒）
    MAX_FRAMES = 150
    cap = cv2.VideoCapture(video_path)
    count = 0
    while count < MAX_FRAMES:
        ret, frame = cap.read()
        if not ret:
            break
        cv2.putText(frame, "LiveTalking", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (128,128,128), 1)
        cv2.imwrite(os.path.join(full_imgs_path, f'{count:08d}.png'), frame)
        count += 1
    cap.release()

    if count == 0:
        return False, "No frames extracted"

    # 读取帧
    input_img_list = sorted(glob(os.path.join(full_imgs_path, '*.png')))
    frames = []
    for img_path in input_img_list:
        frames.append(cv2.imread(img_path))

    # 人脸检测
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    detector = face_detection.FaceAlignment(
        face_detection.LandmarksType._2D, flip_input=False, device=device)

    batch_size = 8
    predictions = []
    try:
        for i in range(0, len(frames), batch_size):
            predictions.extend(
                detector.get_detections_for_batch(np.array(frames[i:i + batch_size])))
    except RuntimeError:
        batch_size = 2
        predictions = []
        for i in range(0, len(frames), batch_size):
            predictions.extend(
                detector.get_detections_for_batch(np.array(frames[i:i + batch_size])))

    del detector
    torch.cuda.empty_cache()

    # 检查是否所有帧都检测到人脸
    none_count = sum(1 for p in predictions if p is None)
    if none_count > len(predictions) * 0.3:
        return False, f"Too many frames without face: {none_count}/{len(predictions)}"

    # 处理坐标和裁剪
    pady1, pady2, padx1, padx2 = 0, 10, 0, 0
    results = []
    for rect, image in zip(predictions, frames):
        if rect is None:
            # 用前一帧的结果
            if results:
                results.append(results[-1])
            else:
                return False, "First frame has no face"
            continue
        y1 = max(0, rect[1] - pady1)
        y2 = min(image.shape[0], rect[3] + pady2)
        x1 = max(0, rect[0] - padx1)
        x2 = min(image.shape[1], rect[2] + padx2)
        results.append([x1, y1, x2, y2])

    # 平滑
    boxes = np.array(results)
    T = 5
    for i in range(len(boxes)):
        if i + T > len(boxes):
            window = boxes[len(boxes) - T:]
        else:
            window = boxes[i: i + T]
        boxes[i] = np.mean(window, axis=0)

    coord_list = []
    for idx, (box, frame) in enumerate(zip(boxes, frames)):
        x1, y1, x2, y2 = [int(v) for v in box]
        face = frame[y1:y2, x1:x2]
        if face.size == 0:
            continue
        resized = cv2.resize(face, (img_size, img_size))
        cv2.imwrite(os.path.join(face_imgs_path, f'{idx:08d}.png'), resized)
        coord_list.append((y1, y2, x1, x2))

    with open(coords_path, 'wb') as f:
        pickle.dump(coord_list, f)

    return True, f"{len(coord_list)} frames processed"


def main():
    success_count = 0
    fail_download = 0
    fail_quality = 0
    fail_avatar = 0
    target = 100

    # 去重已有的avatar
    existing = set(os.listdir(AVATAR_BASE)) if os.path.exists(AVATAR_BASE) else set()

    print(f"=== 批量生成数字人Avatar ===")
    print(f"目标: {target} 个")
    print(f"候选视频ID: {len(CANDIDATE_IDS)} 个")
    print(f"已有Avatar: {len(existing)} 个")
    print("=" * 50)

    for i, vid_id in enumerate(CANDIDATE_IDS):
        if success_count >= target:
            break

        avatar_id = f"avatar_{vid_id}"
        if avatar_id in existing:
            print(f"[{i+1}] ID={vid_id}: 已存在，跳过")
            success_count += 1
            continue

        # 1. 下载视频
        print(f"\n[{i+1}] ID={vid_id}: 下载中...", end=" ", flush=True)
        video_path, res = try_download_video(vid_id)
        if not video_path:
            print("❌ 下载失败")
            fail_download += 1
            continue
        print(f"✓ ({res})", end=" ", flush=True)

        # 2. 质量检查
        ok, info = check_video_quality(video_path)
        if not ok:
            print(f"❌ 质量不合格: {info}")
            os.remove(video_path)
            fail_quality += 1
            continue
        print(f"✓ ({info})", end=" ", flush=True)

        # 3. 生成Avatar
        print(f"\n    生成Avatar...", end=" ", flush=True)
        try:
            ok, msg = generate_avatar(video_path, avatar_id, img_size=256)
            if ok:
                success_count += 1
                print(f"✓ ({msg}) [{success_count}/{target}]")
            else:
                print(f"❌ {msg}")
                fail_avatar += 1
                # 清理失败的avatar
                import shutil
                avatar_path = os.path.join(AVATAR_BASE, avatar_id)
                if os.path.exists(avatar_path):
                    shutil.rmtree(avatar_path)
        except Exception as e:
            print(f"❌ 异常: {e}")
            fail_avatar += 1
            import shutil
            avatar_path = os.path.join(AVATAR_BASE, avatar_id)
            if os.path.exists(avatar_path):
                shutil.rmtree(avatar_path)

        # 清理GPU缓存
        torch.cuda.empty_cache()

    print("\n" + "=" * 50)
    print(f"=== 完成 ===")
    print(f"成功: {success_count}")
    print(f"下载失败: {fail_download}")
    print(f"质量不合格: {fail_quality}")
    print(f"生成失败: {fail_avatar}")

    # 列出所有可用avatar
    avatars = [d for d in os.listdir(AVATAR_BASE) if d.startswith('avatar_')]
    print(f"\n可用Avatar列表 ({len(avatars)} 个):")
    for a in sorted(avatars):
        face_count = len(glob(os.path.join(AVATAR_BASE, a, 'face_imgs', '*.png')))
        print(f"  - {a}: {face_count} frames")


if __name__ == '__main__':
    main()
