import cv2
from pathlib import Path
import argparse
import numpy as np

def variance_of_laplacian(image):
    # Compute the Laplacian of the image and then return the focus
    # measure, which is simply the variance of the Laplacian
    return cv2.Laplacian(image, cv2.CV_64F).var()

def crop_largest_face(img_bgr, face_cascade, margin=0.25, min_size=60):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5)
    if len(faces) == 0:
        return None

    # choose largest face
    x, y, w, h = max(faces, key=lambda r: r[2] * r[3])

    # apply margin
    mx = int(w * margin)
    my = int(h * margin)
    x0 = max(0, x - mx)
    y0 = max(0, y - my)
    x1 = min(img_bgr.shape[1], x + w + mx)
    y1 = min(img_bgr.shape[0], y + h + my)

    face = img_bgr[y0:y1, x0:x1]
    if face.shape[0] < min_size or face.shape[1] < min_size:
        return None
    return face

def process_frames(in_root: Path, out_root: Path, size=160, blur_thresh=80.0, margin=0.25, min_size=60):
    out_root.mkdir(parents=True, exist_ok=True)

    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    
    if face_cascade.empty():
        print("[ERR] Failed to load face cascade classifier")
        return

    for person_dir in sorted([p for p in in_root.iterdir() if p.is_dir()]):
        out_dir = out_root / person_dir.name
        out_dir.mkdir(parents=True, exist_ok=True)
        saved = 0

        for img_path in sorted(person_dir.glob("*.jpg")):
            img = cv2.imread(str(img_path))
            if img is None:
                continue

            face = crop_largest_face(img, face_cascade, margin=margin, min_size=min_size)
            if face is None:
                continue

            # quality filter: blur
            gray_small = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
            blur_value = variance_of_laplacian(gray_small)
            if blur_value < blur_thresh:
                continue

            face_resized = cv2.resize(face, (size, size))
            out_path = out_dir / f"face_{saved:04d}.jpg"
            cv2.imwrite(str(out_path), face_resized)
            saved += 1

        print(f"[OK] {person_dir.name}: saved {saved} faces to {out_dir}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", "-i", type=str, default="data/raw_frames", help="root of extracted frames")
    ap.add_argument("--output", "-o", type=str, default="data/faces", help="output root for cropped faces")
    ap.add_argument("--size", type=int, default=160, help="output face size (pixels)")
    ap.add_argument("--blur", type=float, default=80.0, help="min variance of Laplacian; lower = blurrier allowed")
    ap.add_argument("--margin", type=float, default=0.25, help="extra margin around detected face (0-0.5)")
    ap.add_argument("--min-size", type=int, default=60, help="min width/height of face to accept")
    args = ap.parse_args()

    process_frames(Path(args.input), Path(args.output), size=args.size, blur_thresh=args.blur,
                  margin=args.margin, min_size=args.min_size)

if __name__ == "__main__":
    main()