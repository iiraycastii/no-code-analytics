def normalize(column):
    if not column: return []
    try:
        min_val = min(column)
        max_val = max(column)
        if max_val == min_val: return [0.0] * len(column)
        
        result = []
        for x in column:
            result.append((x - min_val) / (max_val - min_val))
        return result
    except:
        return column # Return as-is if error (e.g. strings)
