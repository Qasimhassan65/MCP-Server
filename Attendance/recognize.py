import cv2
import pickle
import numpy as np
from deepface import DeepFace

# Load trained KNN
with open("knn_model.clf", "rb") as f:
    knn = pickle.load(f)

cap = cv2.VideoCapture(0)
print("[INFO] Starting video stream...")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    try:
        faces = DeepFace.represent(
            img_path=rgb,
            model_name="Facenet",
            enforce_detection=False,
            detector_backend="opencv"
        )
    except:
        faces = []

    for face in faces:
        embedding = np.array(face["embedding"]).reshape(1, -1)
        
        # Get prediction and confidence scores
        name = knn.predict(embedding)[0]
        confidence_scores = knn.predict_proba(embedding)[0]
        
        # Get the confidence for the predicted class
        predicted_class_index = knn.classes_.tolist().index(name)
        confidence_percentage = confidence_scores[predicted_class_index] * 100

        facial_area = face["facial_area"]
        x = facial_area["x"]
        y = facial_area["y"]
        w = facial_area["w"]
        h = facial_area["h"]

        # Display name and confidence percentage
        display_text = f"{name}: {confidence_percentage:.1f}%"
        
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
        cv2.putText(frame, display_text, (x, y-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    cv2.imshow("Face Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
