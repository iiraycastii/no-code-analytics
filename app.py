from flask import Flask, render_template, jsonify, request
import sys
import os
import csv
import math
from werkzeug.utils import secure_filename

sys.path.append(os.path.join(os.path.dirname(__file__), 'algorithms'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'preprocessing'))

from linear_regression import LinearRegressionScratch
from logistic_regression import LogisticRegressionScratch
from knn import KNN
from decision_tree import DecisionTree

from normalization import normalize
from standardization import standardize
from missing_values import fill_missing
from train_test_split import split

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'datasets')

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

global_data = {
    "X": [],
    "y": []
}

@app.route('/')
def index():
    return render_template('index.html')

# Endpoint to upload dataset
@app.route('/upload_dataset', methods=['POST'])
def upload_dataset():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if file and file.filename.endswith('.csv'):
        try:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            X = []
            y = []
            
            with open(filepath, 'r') as csvfile:
                csvreader = csv.reader(csvfile)
                # Skip header
                next(csvreader, None)
                
                rows_count = 0
                cols_count = 0
                
                for row in csvreader:
                    if not row: continue
                    try:
                        vals = [float(v) for v in row if v.strip()]
                        if len(vals) >= 2:
                            # Assume first col is X, last col is y for simplicity
                            X.append(vals[0])
                            y.append(vals[-1])
                            rows_count += 1
                            if cols_count == 0:
                                cols_count = len(vals)
                    except ValueError:
                        continue
            
            # Don't rely on global_data anymore, save file is enough
            # global_data["X"] = X
            # global_data["y"] = y
            
            return jsonify({
                "status": "success",
                "message": "Dataset uploaded successfully",
                "dataset_name": filename,
                "rows": rows_count,
                "columns": cols_count
            })
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    return jsonify({"error": "Invalid file type. Only CSV allowed."}), 400

# Preprocessing Helpers (now integrated into pipeline routing)

@app.route('/get_dataset', methods=['GET'])
def get_dataset():
    dataset_name = request.args.get('name')
    if not dataset_name:
        return jsonify({"error": "Dataset name required"}), 400
        
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], dataset_name)
    if not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found"}), 404
        
    try:
        rows = []
        cols = []
        with open(filepath, 'r') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if header:
                cols = header
                for row in reader:
                     if row:
                        clean_row = []
                        for val in row:
                            try:
                                clean_row.append(float(val))
                            except ValueError:
                                # Keep empty strings as None or empty string?
                                # Let's keep empty string for now, but handle it in stats
                                if val.strip() == '':
                                    clean_row.append(None)
                                else:
                                    clean_row.append(val)
                        rows.append(clean_row)
        
        # Calculate Statistics
        stats = []
        if rows and cols:
            num_rows = len(rows)
            # Transpose to iterate by column
            # Use zip(*rows), but rows might be ragged if CSV is bad. Assume good CSV for now.
            columns_data = list(zip(*rows))
            
            for i, col_name in enumerate(cols):
                if i < len(columns_data):
                    col_vals = columns_data[i]
                    # Filter None
                    valid_vals = [v for v in col_vals if v is not None]
                    missing_count = num_rows - len(valid_vals)
                    
                    # Check Type
                    is_numeric = all(isinstance(v, (int, float)) for v in valid_vals) if valid_vals else False
                    
                    col_stat = {
                        "name": col_name,
                        "missing": missing_count,
                        "type": "Numeric" if is_numeric else "Categorical"
                    }
                    
                    if is_numeric and valid_vals:
                        col_stat["min"] = min(valid_vals)
                        col_stat["max"] = max(valid_vals)
                        col_stat["mean"] = round(sum(valid_vals) / len(valid_vals), 2)
                        col_stat["unique"] = len(set(valid_vals))
                    elif not is_numeric and valid_vals:
                        # Categorical Stats
                        unique_vals = set(valid_vals)
                        col_stat["unique"] = len(unique_vals)
                        # Frequency Count (simple implementation)
                        counts = {}
                        for v in valid_vals:
                            counts[v] = counts.get(v, 0) + 1
                        most_common = max(counts, key=counts.get)
                        col_stat["top"] = most_common
                        col_stat["freq"] = counts[most_common]
                        col_stat["min"] = "-"
                        col_stat["max"] = "-"
                        col_stat["mean"] = "-"
                    else:
                        col_stat["min"] = "-"
                        col_stat["max"] = "-"
                        col_stat["mean"] = "-"
                        
                    stats.append(col_stat)

        return jsonify({
            "name": dataset_name,
            "columns": cols,
            "rows": rows, # Full data for visualization
            "preview": rows[:10], # First 10 rows for preview
            "column_stats": stats,
            "total_rows": len(rows)
        })
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500


@app.route('/get_column_values', methods=['GET'])
def get_column_values():
    dataset_name = request.args.get('dataset')
    col_name = request.args.get('column')
    
    if not dataset_name or not col_name:
        return jsonify({"error": "Dataset and Column name required"}), 400
        
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], dataset_name)
    if not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found"}), 404
        
    try:
        unique_vals = set()
        with open(filepath, 'r') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            
            if not header:
                 return jsonify({"error": "Empty dataset"}), 400
                 
            try:
                col_idx = header.index(col_name)
            except ValueError:
                return jsonify({"error": "Column not found"}), 404
                
            for row in reader:
                if len(row) > col_idx:
                    val = row[col_idx]
                    if val.strip(): # Ignore empty
                        unique_vals.add(val)
                        
        return jsonify({
            "values": sorted(list(unique_vals))
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_predefined_datasets', methods=['GET'])
def get_predefined_datasets():
    """Get list of predefined datasets available for students"""
    predefined_datasets = [
        {
            "name": "sales_data_messy.csv",
            "display_name": "Sales Data (Messy)",
            "description": "Real-world sales dataset with missing values, inconsistent date formats, calculation errors, and various data quality issues. Perfect for data cleaning and preprocessing practice.",
            "rows": 60,
            "columns": 12,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "customer_reviews_messy.csv", 
            "display_name": "Customer Reviews (Messy)",
            "description": "Customer review dataset with missing ratings, inconsistent date formats, empty comments, and mixed data types. Excellent for text processing and data validation exercises.",
            "rows": 60,
            "columns": 9,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "employee_performance_messy.csv",
            "display_name": "Employee Performance (Messy)",
            "description": "HR dataset with outliers in salary and performance scores, potential data entry errors, and inconsistencies. Great for outlier detection and data normalization practice.",
            "rows": 100,
            "columns": 11,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "hospital_records_messy.csv",
            "display_name": "Hospital Records (Messy)",
            "description": "Healthcare dataset with missing discharge dates, inconsistent date formats, missing insurance information, and mixed data types. Perfect for medical data cleaning and validation.",
            "rows": 60,
            "columns": 15,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "inventory_messy.csv",
            "display_name": "Inventory Data (Messy)",
            "description": "Retail inventory dataset with missing stock levels, inconsistent dates, empty supplier information, and various data quality issues. Great for inventory management and data cleaning practice.",
            "rows": 20,
            "columns": 10,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "student_grades_messy.csv",
            "display_name": "Student Grades (Messy)",
            "description": "Educational dataset with missing attendance records, inconsistent date formats, missing grade values, and mixed data types. Perfect for educational data analysis and preprocessing exercises.",
            "rows": 20,
            "columns": 10,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "weather_data_messy.csv",
            "display_name": "Weather Data (Messy)",
            "description": "Meteorological dataset with missing precipitation values, inconsistent date formats, empty condition fields, and various measurement inconsistencies. Excellent for weather data cleaning and validation.",
            "rows": 20,
            "columns": 9,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "bank_transactions_messy.csv",
            "display_name": "Bank Transactions (Messy)",
            "description": "Financial dataset with missing transaction dates, inconsistent date formats, empty balance information, and various data quality issues. Perfect for financial data cleaning and fraud detection practice.",
            "rows": 20,
            "columns": 9,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "fitness_tracker_messy.csv",
            "display_name": "Fitness Tracker (Messy)",
            "description": "Health and fitness dataset with missing sleep hours, inconsistent date formats, missing heart rate data, and various measurement inconsistencies. Great for health data analysis and preprocessing exercises.",
            "rows": 20,
            "columns": 10,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "real_estate_messy.csv",
            "display_name": "Real Estate (Messy)",
            "description": "Property dataset with missing price values, inconsistent date formats, empty property type information, and various data quality issues. Excellent for real estate data cleaning and market analysis.",
            "rows": 20,
            "columns": 10,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "survey_responses_messy.csv",
            "display_name": "Survey Responses (Messy)",
            "description": "Survey dataset with missing rating values, inconsistent date formats, empty response data, and mixed data types. Perfect for survey data cleaning and sentiment analysis practice.",
            "rows": 20,
            "columns": 10,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "website_analytics_messy.csv",
            "display_name": "Website Analytics (Messy)",
            "description": "Web analytics dataset with missing duration values, inconsistent date formats, empty bounce rate data, and various measurement inconsistencies. Great for web analytics data cleaning and validation.",
            "rows": 20,
            "columns": 11,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "stock_prices_messy.csv",
            "display_name": "Stock Prices (Messy)",
            "description": "Financial market dataset with missing dividend values, inconsistent date formats, empty P/E ratio data, and various data quality issues. Perfect for stock market data cleaning and analysis.",
            "rows": 20,
            "columns": 10,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "social_media_messy.csv",
            "display_name": "Social Media (Messy)",
            "description": "Social media dataset with missing hashtag data, inconsistent date formats, empty engagement metrics, and various data quality issues. Excellent for social media data cleaning and analysis.",
            "rows": 20,
            "columns": 10,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "ecommerce_orders_messy.csv",
            "display_name": "E-commerce Orders (Messy)",
            "description": "Online retail dataset with missing shipping costs, inconsistent date formats, empty payment method information, and various data quality issues. Perfect for e-commerce data cleaning and order analysis.",
            "rows": 20,
            "columns": 11,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        },
        {
            "name": "customer_feedback_messy.csv",
            "display_name": "Customer Feedback (Messy)",
            "description": "Customer feedback dataset with missing comment text, inconsistent date formats, empty sentiment data, and mixed data types. Great for customer sentiment analysis and data validation exercises.",
            "rows": 20,
            "columns": 8,
            "type": "data-cleaning",
            "source": "Synthetic Real-World Data"
        }
    ]
    
    # Filter to only include datasets that actually exist
    available_datasets = []
    for dataset in predefined_datasets:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], dataset["name"])
        if os.path.exists(filepath):
            available_datasets.append(dataset)
    
    return jsonify({
        "datasets": available_datasets
    })


def handle_missing_advanced(column, strategy='mean', custom_val=None):
    clean_vals = []
    # Identify valid numeric values
    for x in column:
        if x is not None and not (isinstance(x, float) and math.isnan(x)) and x != "" and x != "NaN":
            try:
                clean_vals.append(float(x))
            except:
                pass

    fill_val = 0
    if strategy == 'mean':
        if clean_vals: fill_val = sum(clean_vals) / len(clean_vals)
    elif strategy == 'median':
        if clean_vals:
            clean_vals.sort()
            n = len(clean_vals)
            if n % 2 == 1: fill_val = clean_vals[n//2]
            else: fill_val = (clean_vals[n//2-1] + clean_vals[n//2]) / 2
    elif strategy == 'mode':
        if clean_vals:
            counts = {}
            for v in clean_vals: counts[v] = counts.get(v, 0) + 1
            fill_val = max(counts, key=counts.get)
    elif strategy == 'custom':
        try: fill_val = float(custom_val) if custom_val is not None else 0
        except: fill_val = 0
    elif strategy == 'remove':
        # Remove logic must be row-wise, but here we process column-wise.
        # Ideally remove happens at dataset level. 
        # For simplicity in this column-func, we can't remove rows easily without sync.
        # Fallback to mean or 0 if 'remove' is passed to a column transfomer mistakenly.
        pass

    result = []
    for x in column:
        should_fill = False
        if x is None or (isinstance(x, float) and math.isnan(x)) or x == "" or x == "NaN":
             should_fill = True
        
        if should_fill:
            result.append(fill_val)
        else:
            result.append(x)
            
    return result

def clean_nan(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    elif isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    return obj

# Endpoint to receive pipeline data from frontend
@app.route('/run_pipeline', methods=['POST'])
def run_pipeline():
    try:
        data = request.json
        pipeline = data.get('pipeline', [])
        print("Received Pipeline:", pipeline)

        dataset_block = next((b for b in pipeline if b.get('type') == 'dataset'), None)
        if not dataset_block:
             return jsonify({ "error": "Pipeline must include a Dataset block" }), 400
        
        algorithm_block = next((b for b in pipeline if b.get('type') == 'algorithm'), None)

        X = []
        y = []
        full_data = [] # List of rows

        dataset_name = dataset_block.get('dataset_name')
        headers = []
        if dataset_name:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], dataset_name)
            if os.path.exists(filepath):
                 with open(filepath, 'r') as csvfile:
                    reader = csv.reader(csvfile)
                    headers = next(reader, None) # Capture header
                    full_data = list(reader)
            else:
                return jsonify({"error": f"Dataset '{dataset_name}' not found."}), 404
        
        # Parse data into columns for processing
        # Convert to float where possible, keep as None/str otherwise
        if not full_data:
             return jsonify({ "error": "Dataset is empty" }), 400

        # Determine number of columns
        num_cols = len(headers) if headers else len(full_data[0])
        cols = [[] for _ in range(num_cols)]
        
        for row in full_data:
            for i in range(num_cols):
                val = None
                if i < len(row):
                    val = row[i]
                
                processed_val = None
                if val is not None:
                     try:
                        if isinstance(val, str) and val.strip() == '':
                            processed_val = None
                        else:
                            processed_val = float(val)
                     except ValueError:
                        processed_val = val
                
                cols[i].append(processed_val)
        
        # Check for user configuration
        dataset_config = dataset_block.get('config')
        
        # --- Filter Dataset to Selected Columns Only ---
        # This ensures validation and processing ignore unselected columns (e.g. ID, Timestamp)
        if dataset_config:
            active_columns = []
            if dataset_config.get('type') == 'supervised':
                if 'features' in dataset_config: 
                    active_columns.extend(dataset_config['features'])
                if 'label' in dataset_config and dataset_config['label']:
                    active_columns.append(dataset_config['label'])
            elif dataset_config.get('type') == 'unsupervised':
                if 'columns' in dataset_config:
                     active_columns.extend(dataset_config['columns'])
            
            # Deduplicate and Filter
            if active_columns and headers:
                unique_active = []
                for c in active_columns:
                    if c not in unique_active: unique_active.append(c)
                
                new_cols = []
                new_headers = []
                
                for name in unique_active:
                    if name in headers:
                        idx = headers.index(name)
                        new_cols.append(cols[idx])
                        new_headers.append(name)
                
                # Replace global pipeline data with restricted subset
                if new_cols:
                    cols = new_cols
                    headers = new_headers
        # ------------------------------------------------
        
        # Preprocessing Steps
        preprocessing_msg = []
        preprocessing_comparison = [] # Store transformations for visualization
        
        # Apply preprocessing blocks
        for block in pipeline:
            if block.get('type') == 'preprocess':
                method = block.get('method')
                
                # Get selected columns from block config
                selected_cols = block.get('config', {}).get('columns', [])
                
                # Snapshot Before (transpose back to rows for display - first 5 rows)
                before_snapshot = []
                if cols and cols[0]:
                    sample_len = min(5, len(cols[0]))
                    for idx in range(sample_len):
                        before_snapshot.append([col[idx] for col in cols])
                
                step_name = ""
                step_desc = ""
                
                # Determine target columns
                # If user has selected specific columns, use those. Otherwise, default to all.
                if selected_cols and len(selected_cols) > 0:
                    target_indices = []
                    for name in selected_cols:
                        if name in headers:
                            target_indices.append(headers.index(name))
                else:
                    target_indices = list(range(len(cols))) # Default: All
                
                # --- VIZ FIX: Correct capture of Before Snapshot ---
                # before_snapshot at line 265 captured ALL columns.
                # We need to refine it to match target_indices logic later.
                # Just keep it as full row snapshot there, and we filter below.
                
                # Helper to check if column is numeric

                def is_numeric_col(col_data):
                    valid_vals = [x for x in col_data if x is not None]
                    return valid_vals and all(isinstance(x, (int, float)) for x in valid_vals)

                if method == 'missing_value_handling':
                    strategy = block.get('config', {}).get('strategy', 'mean')
                    custom_val = block.get('config', {}).get('customValue')
                    
                    if strategy == 'remove':
                        # Row removal logic
                        total_rows = len(cols[0]) if cols else 0
                        rows_to_keep = []
                        removed_count = 0
                        
                        for i in range(total_rows):
                            keep = True
                            for col_idx in target_indices:
                                if col_idx < len(cols):
                                    # Check if this column has enough rows
                                    if i < len(cols[col_idx]):
                                        val = cols[col_idx][i]
                                        # Check for dirty values
                                        if val is None or val == "" or (isinstance(val, float) and math.isnan(val)) or val == "NaN":
                                            keep = False
                                            break
                                    else:
                                        # Column doesn't have this row, treat as missing value
                                        keep = False
                                        break
                            if keep:
                                rows_to_keep.append(i)
                            else:
                                removed_count += 1
                        
                        # Apply Removal
                        if removed_count > 0:
                            for c in range(len(cols)):
                                # Only keep rows that exist in this column
                                cols[c] = [cols[c][i] for i in rows_to_keep if i < len(cols[c])]
                        
                        step_desc = f"Removed {removed_count} rows containing missing values."
                        preprocessing_msg.append(f"Removed Missing Values ({removed_count} rows)")
                        
                    else:
                        # Imputation logic
                        count = 0
                        for i in target_indices:
                            if i < len(cols):
                                cols[i] = handle_missing_advanced(cols[i], strategy, custom_val)
                                count += 1
                        
                        preprocessing_msg.append(f"Handled Missing Values ({strategy})")
                        step_desc = f"Filled missing values using '{strategy}' strategy in {count} columns."
                    
                    step_name = "Missing Value Handling"
                    
                elif method == 'normalization':
                    count = 0
                    for i in target_indices:
                        if i < len(cols) and is_numeric_col(cols[i]):
                            cols[i] = normalize(cols[i])
                            count += 1
                    preprocessing_msg.append("Applied Normalization (Min-Max)")
                    step_name = "Normalization"
                    step_desc = f"Rescaled {count} selected numeric columns to range [0, 1]."
                    
                elif method == 'standardization':
                    count = 0
                    for i in target_indices:
                        if i < len(cols) and is_numeric_col(cols[i]):
                            cols[i] = standardize(cols[i])
                            count += 1
                    preprocessing_msg.append("Applied Standardization (Z-Score)")
                    step_name = "Standardization"
                    step_desc = f"Standardized {count} selected numeric columns to mean 0, std 1."
                
                elif method == 'feature_selection':
                     step_name = "Feature Selection"
                     step_desc = "Selected top features."


                elif method == 'value_standardizer':
                    mapping = block.get('config', {}).get('mapping', {})
                    col_name = block.get('config', {}).get('column')
                    
                    target_indices = [] 
                    
                    if col_name and mapping and headers and col_name in headers:
                        try:
                            idx = headers.index(col_name)
                            target_indices = [idx]
                            count = 0
                            new_col = []
                            for val in cols[idx]:
                                # Check key variations (raw string, or int string if float is int)
                                keys_to_check = []
                                if val is not None:
                                    keys_to_check.append(str(val))
                                    if isinstance(val, float) and val.is_integer():
                                        keys_to_check.append(str(int(val)))
                                
                                matched = False
                                for k in keys_to_check:
                                    if k in mapping:
                                        new_val_str = mapping[k]
                                        # Try to convert replacement to float if possible
                                        try:
                                            new_col.append(float(new_val_str))
                                        except ValueError:
                                            new_col.append(new_val_str)
                                        count += 1
                                        matched = True
                                        break
                                
                                if not matched:
                                    new_col.append(val)
                            
                            cols[idx] = new_col
                            
                            preprocessing_msg.append(f"Standardized Column: {col_name}")
                            step_name = "Value Standardization"
                            step_desc = f"Standardized {count} values in '{col_name}'."
                            
                            # Ensure visualization focuses on this column
                            selected_cols = [col_name]
                            
                        except ValueError:
                             pass
                    else:
                        step_name = "Value Standardization (Skipped)"
                        step_desc = "Configuration missing or column not found."

                elif method == 'categorical_encoder':
                    mapping = block.get('config', {}).get('mapping', {})
                    col_name = block.get('config', {}).get('column')
                    
                    target_indices = [] # Update for viz focus
                    
                    if col_name and mapping and headers and col_name in headers:
                        try:
                            idx = headers.index(col_name)
                            target_indices = [idx] # Only visualize this column
                            count = 0
                            new_col = []
                            for val in cols[idx]:
                                # If exact match (handle string vs number properly)
                                # CSV read values as float if possible or string. 
                                # Our mapping keys are strings.
                                str_val = str(val) if val is not None else ""
                                
                                if str_val in mapping:
                                    try:
                                        new_col.append(float(mapping[str_val]))
                                        count += 1
                                    except ValueError:
                                        new_col.append(val)
                                else:
                                    # Maybe it was already numeric or not in mapping
                                    new_col.append(val)
                            
                            cols[idx] = new_col
                            
                            preprocessing_msg.append(f"Encoded Column: {col_name}")
                            step_name = "Categorical Encoding"
                            step_desc = f"Mapped {count} values in '{col_name}' to numbers."
                            
                        except ValueError:
                             pass
                    else:
                        step_name = "Categorical Encoding (Skipped)"
                        step_desc = "Configuration missing or column not found."


                # Snapshot After
                after_snapshot = []
                
                # Visualization: Only show affected columns + 2 context columns max?
                # Requirement: "only highlight the selected columns".
                # Let's show only the selected columns in the before/after, or all if none specially selected.
                
                viz_indices = target_indices if (selected_cols and target_indices) else list(range(min(5, len(cols))))
                
                viz_headers = []
                if headers:
                    viz_headers = [headers[i] for i in viz_indices if i < len(headers)]
                else:
                    viz_headers = [f"Col {i}" for i in viz_indices]

                # Reconstruct snapshots based on viz_indices
                # Be careful, before_snapshot (captured earlier) assumes full cols.
                
                # Actually, we need to capture specific columns for BEFORE snapshot too.
                # But 'before_snapshot' captured earlier was limited to 5 cols.
                # Let's refactor the whole snapshot logic.
                
                # Since we already modified cols in place, we can't get 'before' now easily unless we kept a copy.
                # But we didn't keep a full copy, only 'before_snapshot' of first 5 cols.
                
                # To support arbitrary column visualization, we need to capture the specific columns BEFORE transformation.
                # This requires moving the 'before_snapshot' logic inside the 'if method...' blocks or right before them but ensuring we know which columns.
                
                # Retrying the block structure:
                # 1. Determine targets
                # 2. Capture BEFORE of those targets
                # 3. Apply Transform
                # 4. Capture AFTER of those targets
                
                # Just for visualization payload construction:
                final_before_viz = []
                final_after_viz = []
                
                # Note: 'before_snapshot' variable from earlier lines (lines ~265) contains full row data of first 5 cols?
                # Reading back: 
                # before_snapshot = []
                # if cols and cols[0]:
                #    sample_len = min(5, len(cols[0]))
                #    for idx in range(sample_len):
                #        before_snapshot.append([col[idx] for col in cols])
                
                # So before_snapshot is list of rows (each row has ALL columns).
                # So we can extract specific columns from it.
                
                if before_snapshot:
                     for row in before_snapshot:
                         filtered_row = [row[i] for i in viz_indices if i < len(row)]
                         final_before_viz.append(filtered_row)
                         
                if cols and cols[0]:
                    sample_len = min(5, len(cols[0]))
                    for idx in range(sample_len):
                        # Construct row from current 'cols' state
                        full_row = [col[idx] for col in cols]
                        filtered_row = [full_row[i] for i in viz_indices if i < len(full_row)]
                        final_after_viz.append(filtered_row)
                
                preprocessing_comparison.append({
                    "method": step_name,
                    "description": step_desc,
                    "headers": viz_headers,
                    "before": final_before_viz,
                    "after": final_after_viz
                })

        # --- VALIDATION: Check for NaNs before preparing X and y ---
        # Only check columns involved in training if possible, but default to reporting all potential issues
        # to simplify student feedback loop.
        
        issues = []
        for idx, col_data in enumerate(cols):
            # Only check if column is numeric or mostly numeric (skip pure text/ID columns if needed, but simplistic is fine)
            
            has_nan = False
            for val in col_data:
                # Check for None, empty string, NaN float
                if val is None or val == "" or (isinstance(val, float) and math.isnan(val)) or val == "NaN":
                    has_nan = True
                    break
            
            if has_nan:
                col_name = headers[idx] if headers and idx < len(headers) else f"Col {idx+1}"
                # Exclude target column if we know it and it allows NaNs (usually target shouldn't have NaNs either)
                issues.append(col_name)

        if issues and algorithm_block: # Only block if running algorithm
             return jsonify({
                 "status": "error",
                 "type": "missing_values",
                 "columns": issues
             })

        # Prepare X and y for training
        X_cols = []
        y_col = []
        
        # If user configured the dataset
        if dataset_config:
            if dataset_config.get('type') == 'supervised':
                label_name = dataset_config.get('label')
                feature_names = dataset_config.get('features', [])
                
                # Find indices from headers
                if headers:
                    try:
                        y_idx = headers.index(label_name)
                        y_col = cols[y_idx]
                        
                        for fname in feature_names:
                            f_idx = headers.index(fname)
                            X_cols.append(cols[f_idx])
                    except ValueError:
                         return jsonify({ "error": "Configured columns not found in dataset headers" }), 400
                else:
                    return jsonify({ "error": "Dataset missing headers for configuration" }), 400
                    
            elif dataset_config.get('type') == 'unsupervised':
                feature_names = dataset_config.get('columns', [])
                if headers:
                    try:
                        for fname in feature_names:
                            f_idx = headers.index(fname)
                            X_cols.append(cols[f_idx])
                        # Unsupervised has no y
                        y_col = [0] * len(X_cols[0]) # Dummy Y
                    except ValueError:
                         return jsonify({ "error": "Configured columns not found" }), 400
        else:
            # Fallback: Assume last column is target y, all others X
            # Only validate column count if we have an algorithm block
            if algorithm_block and len(cols) < 2:
                 return jsonify({ "error": "Dataset needs at least 2 columns (Feature + Target)" }), 400
                 
            X_cols = cols[:-1]
            y_col = cols[-1]
        
        if not X_cols and algorithm_block:
             return jsonify({ "error": "No features selected for training" }), 400

        # Validate numeric features (Basic check to avoid 500 errors) - only when algorithm is present
        if algorithm_block:
            for i_c, col_vals in enumerate(X_cols):
                 non_empty = [v for v in col_vals if v is not None and v != '']
                 if non_empty and any(isinstance(v, str) for v in non_empty):
                     col_name = f"Feature {i_c+1}"
                     if headers and dataset_config:
                          try:
                              feat_names = dataset_config.get('features', [])
                              if i_c < len(feat_names):
                                   col_name = feat_names[i_c]
                          except: pass
                     return jsonify({ "error": f"Column '{col_name}' contains non-numeric data. Algorithms require numeric features. Please select numeric columns." }), 400

        # Transpose back to rows for X
        # X = [[x1, x2], [x1, x2]]
        num_rows = len(X_cols[0])
        X = []
        valid_indices = []
        
        # Check for missing values in X or y
        for i in range(num_rows):
            # Check features
            is_valid = True
            row = []
            for col in X_cols:
                val = col[i]
                if val is None or (isinstance(val, float) and math.isnan(val)):
                    is_valid = False
                    break
                row.append(val)
            
            # Check target
            if is_valid:
                target_val = y_col[i]
                if target_val is None or (isinstance(target_val, float) and math.isnan(target_val)):
                    is_valid = False
            
            if is_valid:
                X.append(row)
                valid_indices.append(i)
        
        if len(X) == 0:
             return jsonify({ "error": "All rows contain missing values. Please add a 'Missing Value Handling' block." }), 400
             
        y = [y_col[i] for i in valid_indices]

        # Train/Test Split
        # We use a fixed seed or just random? Prompt provided random split.
        X_train, X_test, y_train, y_test = split(X, y, test_ratio=0.2)
        
        
        # Train Algorithm
        result_metrics = {}
        predictions = []
        algo_name = "None"
        
        # Construction of Graph Data for Visualization
        graph_data = None
        
        if algorithm_block:
            method = algorithm_block.get('method')
            algo_name = method.replace('_', ' ').title()
            
            if method == 'linear_regression':
                if len(X_train[0]) == 1:
                    X_train_data = [row[0] for row in X_train]
                    X_test_data = [row[0] for row in X_test]
                    
                    # Heuristic: Check if normalization is needed
                    # If mean > 100 or std > 10, reduce LR or suggest normalization
                    mean_x = sum(X_train_data)/len(X_train_data) if X_train_data else 0
                    if abs(mean_x) > 10:
                        # Use smaller learning rate for unscaled data
                        model = LinearRegressionScratch(learning_rate=0.0001, epochs=1000)
                    else:
                        model = LinearRegressionScratch(learning_rate=0.01, epochs=1000)
                        
                    model.fit(X_train_data, y_train)
                    
                    # Check for Divergence (NaN)
                    if math.isnan(model.weight) or math.isnan(model.bias) or math.isinf(model.weight):
                         result_metrics['status'] = "Diverged"
                         result_metrics['mse'] = "N/A"
                         predictions = []
                         # Provide fallback for graph to avoid crash
                         model.weight = 0.0
                         model.bias = sum(y_train)/len(y_train) if y_train else 0
                         
                         preprocessing_msg.append("WARNING: Gradient Descent Diverged. Please add a 'Normalization' block.")
                    
                    test_preds = []
                    for val in X_test_data:
                        test_preds.append(model.weight * val + model.bias)
                    
                    try:
                        mse = sum((yt - yp) ** 2 for yt, yp in zip(y_test, test_preds)) / len(y_test)
                        result_metrics['mse'] = f"{mse:.4f}"
                    except:
                        result_metrics['mse'] = "N/A"
                        
                    result_metrics['weights'] = f"{model.weight:.4f}"
                    result_metrics['bias'] = f"{model.bias:.4f}"
                    predictions = test_preds[:10]
                    
                    # Graph Data
                    graph_data = {
                        "type": "linear_regression",
                        "x_test": X_test_data[:200], # Limit points
                        "y_test": y_test[:200],
                        "y_pred": test_preds[:200],
                        "slope": model.weight,
                        "intercept": model.bias
                    }
                else:
                    return jsonify({"error": "Linear Regression supports only 1 Feature."}), 400
                
            elif method == 'logistic_regression':
                if len(X_train[0]) == 1:
                    X_train_data = [row[0] for row in X_train]
                    X_test_data = [row[0] for row in X_test]
                    
                    model = LogisticRegressionScratch(lr=0.01, epochs=1000)
                    model.fit(X_train_data, y_train)
                    test_preds = model.predict(X_test_data)
                    
                    correct = sum(1 for yt, yp in zip(y_test, test_preds) if yt == yp)
                    acc = correct / len(y_test) if y_test else 0
                    result_metrics['accuracy'] = f"{acc*100:.2f}%"
                    result_metrics['weights'] = f"{model.weight:.4f}"
                    result_metrics['bias'] = f"{model.bias:.4f}"
                    predictions = test_preds[:10]
                    
                    graph_data = {
                        "type": "logistic_regression",
                        "x_test": X_test_data,
                        "y_test": y_test,
                        "y_pred": test_preds,
                        "weight": model.weight,
                        "bias": model.bias
                    }
                else:
                    return jsonify({"error": "Logistic Regression supports only 1 Feature."}), 400
            
            elif method == 'knn':
                k = 3
                model = KNN(k=k)
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                
                correct = sum(1 for yt, yp in zip(y_test, preds) if yt == yp)
                acc = correct / len(y_test)
                result_metrics['accuracy'] = f"{acc*100:.2f}%"
                result_metrics['k'] = k
                predictions = preds[:10]
                
                if len(X_train[0]) <= 2:
                    graph_data = {
                        "type": "classification_scatter",
                        "x_test": [r[0] for r in X_test],
                        "y_test": [r[1] if len(r)>1 else 0 for r in X_test],
                        "classes": y_test,
                        "preds": preds
                    }
                
            elif method == 'decision_tree':
                model = DecisionTree(max_depth=5)
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                
                correct = sum(1 for yt, yp in zip(y_test, preds) if yt == yp)
                acc = correct / len(y_test)
                result_metrics['accuracy'] = f"{acc*100:.2f}%"
                predictions = preds[:10]
                
                if len(X_train[0]) <= 2:
                    graph_data = {
                        "type": "classification_scatter",
                        "x_test": [r[0] for r in X_test],
                        "y_test": [r[1] if len(r)>1 else 0 for r in X_test],
                        "classes": y_test,
                        "preds": preds
                    }

        # Construct Response
        response = {
            "status": "success",
            "educational": {
                "algorithm": algo_name,
                "preprocessing": preprocessing_msg,
                "explanation": f"Model trained on {len(X_train)} samples, tested on {len(X_test)} samples.",
                "transformations": preprocessing_comparison,
                "graph_data": graph_data,
                **result_metrics
            },
            "predictions": predictions,
            "processed_data": {
                # Return first 10 rows of processed data for visualization
                "columns": ["Feature 1", "Target"], # Simplified headers
                "rows": [row + [yt] for row, yt in zip(X[:10], y[:10])]
            }
        }
        
        # If Regression, pass MSE to root
        if 'mse' in result_metrics:
            response['mse'] = result_metrics['mse']
            
        return jsonify(clean_nan(response))

    except Exception as e:
        print(f"Error processing pipeline: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/export_dataset_part', methods=['POST'])
def export_dataset_part():
    try:
        data = request.json
        original_name = data.get('dataset')
        # Range formats:
        # "A1:C10" (Rectangle)
        # "row:1" (Single Row 1-based)
        # "col:A" (Single column)
        # "range:1,1,10,3" (r1, c1, r2, c2 0-based inclusive start, exclusive end)
        
        selection_range = data.get('range') 
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(original_name))
        if not os.path.exists(filepath):
            return jsonify({"error": "Dataset not found"}), 404

        # Read Full Data
        rows = []
        header = []
        with open(filepath, 'r') as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
                rows = list(reader)
            except StopIteration:
                pass
        
        if not header:
             return jsonify({"error": "Empty dataset"}), 400

        # Helper: Column Letter to Index (A->0, Z->25, AA->26)
        def col_to_idx(col_str):
            col_str = col_str.upper()
            idx = 0
            for char in col_str:
                if 'A' <= char <= 'Z':
                    idx = idx * 26 + (ord(char) - ord('A') + 1)
            return idx - 1

        # Determine indices (0-based)
        # r_start, r_end (exclusive), c_start, c_end (exclusive)
        r_start, r_end = 0, len(rows)
        c_start, c_end = 0, len(header)
        
        subset_data = [] # List of rows
        subset_header = header # Default all columns

        action_type = "full"
        
        if selection_range:
            parts = selection_range.split(':')
            if len(parts) == 2 and parts[0].lower() == 'row':
                # "row:10" -> Row 10 (index 9)
                try:
                    r_idx = int(parts[1]) - 1
                    if 0 <= r_idx < len(rows):
                        r_start = r_idx
                        r_end = r_idx + 1
                        action_type = "row"
                except: pass
                
            elif len(parts) == 2 and parts[0].lower() == 'col':
                # "col:C" -> Column C (index 2)
                try:
                    c_idx = col_to_idx(parts[1])
                    if 0 <= c_idx < len(header):
                        c_start = c_idx
                        c_end = c_idx + 1
                        action_type = "col"
                except: pass
            
            elif ',' in selection_range:
                # "range:r1,c1,r2,c2" (custom internal format if frontend sends it)
                # But requirement says "A1:C10". Frontend will convert or backend parses.
                # Let's stick to parsing "A1:C10".
                pass
            
            elif ':' in selection_range:
                 # "A1:C10" Excel range
                 # Parse Start
                 import re
                 
                 def parse_cell(cell):
                     match = re.match(r"([A-Z]+)([0-9]+)", cell.upper())
                     if match:
                         c_str, r_str = match.groups()
                         return col_to_idx(c_str), int(r_str) - 1
                     return 0, 0
                 
                 start_cell, end_cell = parts
                 c1, r1 = parse_cell(start_cell)
                 c2, r2 = parse_cell(end_cell)
                 
                 r_start, r_end = min(r1, r2), max(r1, r2) + 1
                 c_start, c_end = min(c1, c2), max(c1, c2) + 1
                 action_type = "range"

        # Apply Slice
        # 1. Header Slice
        subset_header = header[c_start:c_end]
        
        # 2. Row Slice
        # Validate bounds
        r_start = max(0, r_start)
        r_end = min(len(rows), r_end)
        
        for i in range(r_start, r_end):
            original_row = rows[i]
            # Handle row length mismatch
            row_len = len(original_row)
            
            # Slice row
            # If row is shorter than c_start, it's empty
            if row_len <= c_start:
                 sliced_row = [''] * (c_end - c_start)
            else:
                 # Slice available part
                 sliced_part = original_row[c_start : min(c_end, row_len)]
                 # Pad if needed
                 while len(sliced_part) < (c_end - c_start):
                     sliced_part.append('')
                 sliced_row = sliced_part
                 
            subset_data.append(sliced_row)
            
        # Write New File
        base_name = os.path.splitext(original_name)[0]
        # Generate descriptive suffix based on selection type
        if action_type == "row":
            row_num = r_start + 1  # Convert to 1-based for display
            suffix = f"_Row{row_num}"
        elif action_type == "col":
            col_name = header[c_start] if c_start < len(header) else f"Col{c_start + 1}"
            suffix = f"_{col_name}"
        elif action_type == "range":
            # Convert indices to Excel-like notation
            def idx_to_col(idx):
                s = ''
                while idx >= 0:
                    s = chr((idx % 26) + 65) + s
                    idx = idx // 26 - 1
                return s
            start_col = idx_to_col(c_start)
            end_col = idx_to_col(c_end - 1)
            start_row = r_start + 1
            end_row = r_end
            suffix = f"_Range{start_col}{start_row}:{end_col}{end_row}"
        else:
            suffix = "_part"
        
        new_filename = f"{base_name}{suffix}.csv"
        
        # Ensure unique name
        counter = 1
        while os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], new_filename)):
            new_filename = f"{base_name}{suffix}_{counter}.csv"
            counter += 1
            
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
        
        with open(save_path, 'w', newline='') as f:
            writer = csv.writer(f)
            # Include column names (header) in the export data for proper visualization
            writer.writerow(subset_header)
            writer.writerows(subset_data)
        
        return jsonify({
            "new_dataset": new_filename,
            "message": f"Exported {len(subset_data)} rows and {len(subset_header)} columns."
        })

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

import math

def normalize_data(data):
    if not data: return []
    min_val = min(data)
    max_val = max(data)
    if max_val == min_val: return [0.0 for _ in data]
    return [(x - min_val) / (max_val - min_val) for x in data]

def standardize_data(data):
    if not data: return []
    n = len(data)
    mean = sum(data) / n
    variance = sum((x - mean) ** 2 for x in data) / n
    std_dev = math.sqrt(variance)
    if std_dev == 0: return [0.0 for _ in data]
    return [(x - mean) / std_dev for x in data]

def handle_missing(data):
    # filtered already in load but if we had None
    clean_vals = [x for x in data if x is not None]
    if not clean_vals: return data
    mean = sum(clean_vals) / len(clean_vals)
    return [x if x is not None else mean for x in data]

