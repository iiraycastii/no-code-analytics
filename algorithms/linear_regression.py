"""
Linear Regression from Scratch
Implemented for ML Visual Learning Platform
"""

class LinearRegressionScratch:
    def __init__(self, learning_rate=0.01, epochs=1000):
        """
        Initialize the Linear Regression model.
        
        Args:
            learning_rate (float): The step size for gradient descent (default: 0.01)
            epochs (int): Number of iterations for training (default: 1000)
        """
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.weight = 0.0
        self.bias = 0.0

    def fit(self, X, y):
        """
        Train the model using Gradient Descent.
        
        Args:
            X (list): List of feature values (independent variable)
            y (list): List of target values (dependent variable)
        """
        n = len(X)
        
        # Training loop
        for epoch in range(self.epochs):
            # 1. Initialize gradients for this epoch
            dw = 0.0
            db = 0.0
            
            # 2. Iterate through all data points to calculate gradients
            for i in range(n):
                # Predict value for current sample
                # Formula: y = mx + b
                y_pred_i = (self.weight * X[i]) + self.bias
                
                # Calculate error
                error = y[i] - y_pred_i
                
                # Accumulate gradients
                # dw = (-2/n) * sum(X * (y - y_pred)) -> we sum X*(y-y_pred) here
                # Note: The formula given says dw = (-2/n) * sum(X_i * (y_i - y_pred_i))
                # So we sum X_i * (y_i - y_pred_i) first
                dw += X[i] * (y[i] - y_pred_i)
                db += (y[i] - y_pred_i)
            
            # 3. Finalize gradients (multiply by -2/n)
            dw = (-2 / n) * dw
            db = (-2 / n) * db
            
            # 4. Update parameters
            self.weight = self.weight - (self.learning_rate * dw)
            self.bias = self.bias - (self.learning_rate * db)

    def predict(self, X):
        """
        Make predictions using fit parameters.
        
        Args:
            X (list): List of feature values to predict
            
        Returns:
            list: Predicted target values
        """
        predictions = []
        for x_val in X:
            y_pred = (self.weight * x_val) + self.bias
            predictions.append(y_pred)
        return predictions

    def mse(self, y_true, y_pred):
        """
        Calculate Mean Squared Error.
        
        Args:
            y_true (list): Actual values
            y_pred (list): Predicted values
            
        Returns:
            float: The Mean Squared Error
        """
        n = len(y_true)
        sum_squared_error = 0.0
        for i in range(n):
            diff = y_true[i] - y_pred[i]
            sum_squared_error += diff ** 2
            
        return sum_squared_error / n

if __name__ == "__main__":
    # Test Data
    X = [1, 2, 3, 4, 5]
    y = [2, 4, 6, 8, 10]
    
    # Create model
    print("Initializing Linear Regression Model (Scratch)...")
    model = LinearRegressionScratch(learning_rate=0.01, epochs=1000)
    
    # Train
    print("Training...")
    model.fit(X, y)
    
    # Results
    print(f"\nTraining Completed.")
    print(f"Final Weight: {model.weight:.4f}")
    print(f"Final Bias: {model.bias:.4f}")
    
    # Prediction
    print("\nTesting Prediction:")
    preds = model.predict(X)
    print(f"Input: {X}")
    print(f"Predictions: {[round(p, 4) for p in preds]}")
    print(f"Actual: {y}")
    
    # MSE
    mse_val = model.mse(y, preds)
    print(f"Final MSE: {mse_val:.6f}")
