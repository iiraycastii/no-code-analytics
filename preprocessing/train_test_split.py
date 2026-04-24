import random

def split(X, Y, test_ratio=0.2):
    if len(X) != len(Y):
        raise ValueError("X and Y must have same length")
        
    data = list(zip(X, Y))
    random.shuffle(data)
    
    split_index = int(len(data) * (1 - test_ratio))
    
    train = data[:split_index]
    test = data[split_index:]
    
    # Unpack
    if train:
        X_train, Y_train = zip(*train)
    else:
        X_train, Y_train = [], []
        
    if test:
        X_test, Y_test = zip(*test)
    else:
        X_test, Y_test = [], []
        
    return list(X_train), list(X_test), list(Y_train), list(Y_test)
