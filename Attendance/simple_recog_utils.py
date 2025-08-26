# simple_recog_utils.py
import os
import cv2
import pickle
import numpy as np
import pandas as pd
from datetime import date, datetime

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

def detect_faces_simple(image_bgr):
    """Simple face detection using OpenCV's Haar cascade"""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    
    # Load the face cascade
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
    
    results = []
    for (x, y, w, h) in faces:
        # For now, we'll use a mock embedding since we don't have the full pipeline
        # In a real implementation, you'd extract features here
        results.append({
            "box": (x, y, w, h),
            "confidence": 0.8  # Mock confidence
        })
    
    return results

def mark_attendance_from_image_path(image_path: str, write_csv: bool = True):
    if not os.path.exists(image_path):
        return {"ok": False, "error": f"Image not found: {image_path}"}

    img = cv2.imread(image_path)
    if img is None:
        return {"ok": False, "error": f"Failed to read image: {image_path}"}

    faces = detect_faces_simple(img)
    results = []
    unique_marked = set()

    for f in faces:
        # For now, we'll use a mock prediction since we don't have the full embedding pipeline
        # In a real implementation, you'd extract embeddings and use KNN.predict()
        
        # Mock: randomly select from available names for demonstration
        available_names = KNN.classes_
        name = np.random.choice(available_names)  # This is just for demo - replace with real prediction
        
        results.append({
            "label": str(name),  # Convert numpy string to Python string
            "box": {"x": int(f["box"][0]), "y": int(f["box"][1]), "w": int(f["box"][2]), "h": int(f["box"][3])}
        })

        if write_csv and name not in unique_marked:
            _append_attendance_csv(name)
            unique_marked.add(name)

    out = {
        "ok": True,
        "image": os.path.abspath(image_path),
        "recognized": results,
        "csv_path": _today_csv_path() if write_csv else None,
        "message": f"Detected {len(results)} faces and marked attendance for {len(unique_marked)} people"
    }
    return out
