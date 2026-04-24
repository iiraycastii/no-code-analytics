import math

class LogisticRegressionScratch:
    def __init__(self, lr=0.01, epochs=1000):
        self.lr = lr
        self.epochs = epochs
        self.weight = 0.0
        self.bias = 0.0
        self.loss_history = []

    def sigmoid(self, z):
        try:
            return 1 / (1 + math.exp(-z))
        except OverflowError:
            return 0 if z < 0 else 1

    def fit(self, X, y):
        n = len(X)
        for _ in range(self.epochs):
            # Gradients
            dw = 0
            db = 0
            
            for i in range(n):
                z = self.weight * X[i] + self.bias
                y_pred = self.sigmoid(z)
                
                # Gradient of Binary Cross Entropy
                # dz = y_pred - y
                dz = y_pred - y[i]
                
                dw += X[i] * dz
                db += dz
            
            # Update weights (Average gradient)
            self.weight -= self.lr * (dw / n)
            self.bias -= self.lr * (db / n)

    def predict_prob(self, X):
        probs = []
        for x in X:
            z = self.weight * x + self.bias
            probs.append(self.sigmoid(z))
        return probs

    def predict(self, X):
        probs = self.predict_prob(X)
        return [1 if p >= 0.5 else 0 for p in probs]
