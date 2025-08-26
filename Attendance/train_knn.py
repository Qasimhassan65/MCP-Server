import pickle
import numpy as np
from sklearn.neighbors import KNeighborsClassifier

# Load encodings
with open("encodings.pickle", "rb") as f:
    data = pickle.load(f)

X = np.array(data["encodings"])
y = np.array(data["names"])

# Train KNN classifier with more neighbors for better confidence
knn = KNeighborsClassifier(n_neighbors=5, metric="euclidean")
knn.fit(X, y)

# Save model
with open("knn_model.clf", "wb") as f:
    pickle.dump(knn, f)

print("[INFO] KNN model trained and saved as knn_model.clf")