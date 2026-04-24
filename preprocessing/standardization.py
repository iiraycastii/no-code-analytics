import math

def standardize(column):
    if not column: return []
    try:
        n = len(column)
        mean = sum(column) / n
        variance = sum((x - mean) ** 2 for x in column) / n
        std = math.sqrt(variance)
        
        if std == 0: return [0.0] * n
        
        return [(x - mean) / std for x in column]
    except:
        return column
