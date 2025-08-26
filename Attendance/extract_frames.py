import cv2
from pathlib import Pathq
import argparse

def extract_frames(video_path: Path, out_dir: Path, step: int = 5, max_frames: int = 80):
    out_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[WARN] Could not open {video_path}")
        return 0

    count = 0
    saved = 0
    while saved < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        # Save every Nth frame
        if count % step == 0:
            out_path = out_dir / f"frame_{saved:04d}.jpg"
            cv2.imwrite(str(out_path), frame)
            saved += 1
        count += 1

    cap.release()
    print(f"[OK] {video_path.name}: saved {saved} frames to {out_dir}")
    return saved

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", "-i", type=str, default="data/videos", help="folder of video files")
    ap.add_argument("--output", "-o", type=str, default="data/raw_frames", help="output root for frames")
    ap.add_argument("--step", type=int, default=5, help="save every Nth frame")
    ap.add_argument("--max-frames", type=int, default=80, help="max frames to save per video")
    args = ap.parse_args()

    in_root = Path(args.input)
    out_root = Path(args.output)
    out_root.mkdir(parents=True, exist_ok=True)

    # Check if input is a file or directory
    if in_root.is_file():
        videos = [in_root]
    else:
        videos = [p for p in in_root.glob("*") if p.suffix.lower() in {".mp4", ".avi", ".mov", ".mkv", ".webm"}]
    
    if not videos:
        print(f"[ERR] No videos found in {in_root}")
        return

    for vid in videos:
        label = vid.stem  # e.g., Ali_001
        extract_frames(vid, out_root / label, step=args.step, max_frames=args.max_frames)

if __name__ == "__main__":
    main()