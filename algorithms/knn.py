import math

class KNN:
    def __init__(self, k=3):
        self.k = k
        self.X = []
        self.Y = []

    def fit(self, X, Y):
        self.X = X
        self.Y = Y

    def distance(self, a, b):
        # Handle scalar (1D) or vector (multidimensional)
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
             return abs(a - b)
        elif isinstance(a, list) and isinstance(b, list):
             # Euclidean
             sum_sq = sum((ai - bi) ** 2 for ai, bi in zip(a, b))
             return math.sqrt(sum_sq)
        else:
             return 0 # Error fallback

    def predict(self, X_test):
        predictions = []
        for x in X_test:
            distances = []
            for i in range(len(self.X)):
                d = self.distance(x, self.X[i])
                distances.append((d, self.Y[i]))
            
            distances.sort(key=lambda x: x[0])
            
            neighbors = distances[:self.k]
            labels = [label for _, label in neighbors]
            
            if not labels:
                predictions.append(None)
                continue
                
            # Voting
            prediction = max(set(labels), key=labels.count)
            predictions.append(prediction)
            
        return predictions
