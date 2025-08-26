import os
import numpy as np
import pickle
from deepface import DeepFace

# Path to faces folder
DATASET_DIR = "data/faces"  # Changed to match your folder structure
ENCODINGS_PATH = "encodings.pickle"

known_encodings = []
known_names = []

# Loop through each person's folder
for person_folder in os.listdir(DATASET_DIR):
    person_path = os.path.join(DATASET_DIR, person_folder)
    if not os.path.isdir(person_path):
        continue

    # Person's name is folder name
    name = person_folder
    print(f"Processing {name}...")

    # Loop over each image of that person
    for image_name in os.listdir(person_path):
        image_path = os.path.join(person_path, image_name)
        print(f"  Processing {image_name}...")

        try:
            # Use DeepFace to extract face embeddings
            embedding_objs = DeepFace.represent(
                img_path=image_path,
                model_name="Facenet",
                enforce_detection=False,  # Continue even if no face found
                detector_backend="opencv"
            )
            
            if embedding_objs:
                # Get the first face found
                embedding = embedding_objs[0]["embedding"]
                known_encodings.append(embedding)
                known_names.append(name)
                print(f"    ✓ Face found and encoded")
            else:
                print(f"    ⚠ No face detected in {image_name}")
                
        except Exception as e:
            print(f"    ✗ Error processing {image_name}: {str(e)}")
            continue

# Save encodings + labels
data = {"encodings": known_encodings, "names": known_names}
with open(ENCODINGS_PATH, "wb") as f:
    pickle.dump(data, f)

print(f"\n[SUCCESS] Encodings saved to {ENCODINGS_PATH}")
print(f"Total faces encoded: {len(known_encodings)}")
print(f"People detected: {set(known_names)}")