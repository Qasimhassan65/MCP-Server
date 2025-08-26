import cv2
import os

def capture_faces(person_name, save_dir, num_samples=20):
    # Create directory for new person
    person_dir = os.path.join(save_dir, person_name)
    os.makedirs(person_dir, exist_ok=True)

    # Initialize camera
    cap = cv2.VideoCapture(0)  # 0 = default webcam
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    count = 0
    print(f"[INFO] Starting face capture for {person_name}. Look at the camera...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Convert to grayscale for detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100))

        for (x, y, w, h) in faces:
            # Draw bounding box
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

            # Save the face region
            face = frame[y:y + h, x:x + w]
            face_filename = os.path.join(person_dir, f"{count}.jpg")
            cv2.imwrite(face_filename, face)

            count += 1
            print(f"[INFO] Captured image {count}/{num_samples}")

            # Stop after required number of samples
            if count >= num_samples:
                cap.release()
                cv2.destroyAllWindows()
                print(f"[INFO] Face capture complete for {person_name}. Images saved at {person_dir}")
                return

        # Show live feed with bounding box
        cv2.imshow("Face Capture", frame)

        # Press 'q' to quit early
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    # Example: new person "video9"
    save_path = r"D:\Qasim\AI-ML Bootcamp\Projects\Face Recognition\Attendance\data\faces"
    person_name = input("Enter your name: ")  # change this to your name/folder
    capture_faces(person_name, save_path, num_samples=200)
