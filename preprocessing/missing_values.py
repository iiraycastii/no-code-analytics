def fill_missing(column):
    # Separate numeric values to calculate mean
    clean = []
    for x in column:
        # Check standard missing markers
        if x is not None and x != "" and x != "NaN" and not (isinstance(x, float) and x != x):
            try:
                clean.append(float(x))
            except:
                pass
                
    if not clean: return column # If no numeric data, return as-is
    
    mean = sum(clean) / len(clean)
    
    result = []
    for x in column:
        should_fill = False
        if x is None or x == "" or x == "NaN":
            should_fill = True
        elif isinstance(x, float) and x != x: # check nan
            should_fill = True
            
        if should_fill:
            result.append(mean)
        else:
            try:
                result.append(float(x))
            except:
                result.append(x)
                
    return result
