# recog_utils.py
import os
import cv2
import pickle
import numpy as np
import pandas as pd
from datetime import date, datetime
from deepface import DeepFace

# -------- Paths (edit if you keep models elsewhere) ----------
ROOT = os.path.dirname(os.path.abspath(__file__))
ATT_DIR = os.path.join(ROOT, "Attendance")
KNN_PATH = os.path.join(ROOT, "knn_model.clf")

os.makedirs(ATT_DIR, exist_ok=True)

# Load KNN model
with open(KNN_PATH, "rb") as f:
    KNN = pickle.load(f)

def _today_csv_path() -> str:
    datetoday = date.today().strftime("%m_%d_%y")
    csv_path = os.path.join(ATT_DIR, f"Attendance-{datetoday}.csv")
    if not os.path.exists(csv_path):
        with open(csv_path, "w", encoding="utf-8") as f:
            f.write("Name,Time\n")
    return csv_path

def _append_attendance_csv(name: str) -> None:
    csv_path = _today_csv_path()
    df = pd.read_csv(csv_path)
    # mark once per day per person
    if name not in df["Name"].values:
        with open(csv_path, "a", encoding="utf-8") as f:
            f.write(f"{name},{datetime.now().strftime('%H:%M:%S')}\n")

def detect_and_embed_faces(image_bgr):
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    reps = DeepFace.represent(
        img_path=rgb,
        model_name="Facenet",
        enforce_detection=False,
        detector_backend="opencv"
    )
    faces = []
    if isinstance(reps, list):
        for r in reps:
            emb = np.array(r["embedding"], dtype="float32")
            fa = r.get("facial_area", {})
            box = (int(fa.get("x", 0)), int(fa.get("y", 0)),
                   int(fa.get("w", 0)), int(fa.get("h", 0)))
            faces.append({"embedding": emb, "box": box})
    return faces

def mark_attendance_from_image_path(image_path: str, write_csv: bool = True):
    if not os.path.exists(image_path):
        return {"ok": False, "error": f"Image not found: {image_path}"}

    img = cv2.imread(image_path)
    if img is None:
        return {"ok": False, "error": f"Failed to read image: {image_path}"}

    faces = detect_and_embed_faces(img)
    results = []
    unique_marked = set()

    for f in faces:
        embedding = f["embedding"].reshape(1, -1)
        name = KNN.predict(embedding)[0]  # no unknown logic
        results.append({
            "label": name,
            "box": {"x": f["box"][0], "y": f["box"][1], "w": f["box"][2], "h": f["box"][3]}
        })

        if write_csv and name not in unique_marked:
            _append_attendance_csv(name)
            unique_marked.add(name)

    out = {
        "ok": True,
        "image": os.path.abspath(image_path),
        "recognized": results,
        "csv_path": _today_csv_path() if write_csv else None
    }
    return out
