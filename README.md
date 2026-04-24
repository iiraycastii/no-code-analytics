# ML Visual Learning Platform

A comprehensive no-code analytics platform that provides an interactive drag-and-drop interface for building machine learning pipelines visually.

## 🚀 Features

### Visual Pipeline Builder
- **Drag-and-Drop Interface**: Intuitive canvas for creating ML workflows
- **Real-time Connections**: Visual connections between pipeline blocks using SVG
- **Interactive Configuration**: Modal-based system for configuring each component

### Dataset Management
- **CSV Upload Support**: Easy dataset import and management
- **Data Preview**: Interactive preview of uploaded datasets
- **Column Statistics**: Automatic analysis and visualization of data features
- **Multiple Sample Datasets**: Pre-loaded datasets for experimentation

### Preprocessing Tools
- **Missing Value Handling**: Multiple strategies for dealing with missing data
- **Normalization & Standardization**: Scale features for optimal model performance
- **Categorical Encoding**: Convert categorical variables to numerical format
- **Train/Test Split**: Proper data partitioning for model evaluation

### Machine Learning Algorithms
- **Linear Regression**: From-scratch implementation for regression tasks
- **Logistic Regression**: Binary classification algorithm
- **K-Nearest Neighbors (KNN)**: Instance-based learning algorithm
- **Decision Tree**: Tree-based classification and regression

### Interactive Visualization
- **Before/After Comparisons**: Visual feedback for preprocessing steps
- **Real-time Results**: Immediate visualization of model outputs
- **Data Transformation Preview**: See how preprocessing affects your data

## 🏗️ Technical Architecture

### Backend
- **Flask Framework**: RESTful API endpoints for data processing
- **Custom ML Implementations**: All algorithms built from scratch
- **Real-time Data Processing**: Efficient handling of data transformations

### Frontend
- **Vanilla JavaScript**: Lightweight, performant client-side logic
- **HTML5 Drag & Drop API**: Native browser support for drag operations
- **SVG Graphics**: Scalable vector graphics for pipeline connections
- **Responsive Design**: Modern CSS with Tailwind-inspired styling

### Data Flow
1. **Upload** → Dataset import and validation
2. **Preprocess** → Apply data transformations
3. **Configure** → Set algorithm parameters
4. **Train** → Build and train ML models
5. **Evaluate** → Analyze model performance

## 📁 Project Structure

```
ml_visual_learning/
├── app.py                          # Main Flask application (1,129 lines)
├── templates/
│   └── index.html                  # Frontend interface (597 lines)
├── static/
│   ├── css/
│   │   └── style.css              # Styling for the interface
│   └── js/
│       └── canvas.js              # Canvas logic and drag-drop functionality
├── algorithms/                     # ML algorithm implementations
│   ├── linear_regression.py
│   ├── logistic_regression.py
│   ├── knn.py
│   └── decision_tree.py
├── preprocessing/                  # Data preprocessing functions
│   ├── missing_values.py
│   ├── normalization.py
│   ├── standardization.py
│   └── train_test_split.py
└── datasets/                      # Sample datasets for testing
    ├── customer_reviews_messy.csv
    ├── employee_performance_messy.csv
    ├── hospital_records_messy.csv
    └── sales_data_messy.csv
```

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.7 or higher
- pip package manager

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/IIraycastII/No-code-analytics.git
   cd No-code-analytics/ml_visual_learning
   ```

2. **Install required dependencies**
   ```bash
   pip install flask pandas numpy scikit-learn
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Access the application**
   Open your web browser and navigate to `http://localhost:5000`

## 📖 Usage Guide

### Creating Your First Pipeline

1. **Upload Dataset**
   - Click the "Upload Dataset" button
   - Select a CSV file from your computer
   - Preview the data and configure column types

2. **Add Preprocessing Steps**
   - Drag preprocessing blocks from the toolbar
   - Connect them to your dataset
   - Configure parameters in the modal dialogs

3. **Choose ML Algorithm**
   - Select an algorithm from the ML section
   - Connect it to your preprocessed data
   - Set hyperparameters as needed

4. **Run the Pipeline**
   - Click the "Run Pipeline" button
   - Monitor progress in real-time
   - View results and visualizations

### Sample Datasets
The platform includes several sample datasets to help you get started:
- **Sales Data**: E-commerce sales information with missing values
- **Customer Reviews**: Sentiment analysis dataset
- **Employee Performance**: HR analytics data
- **Hospital Records**: Medical data for classification tasks

## 🎯 Educational Purpose

This platform is designed as an educational tool for:
- **Learning ML Concepts**: Visual understanding of data preprocessing and model training
- **No-Code Development**: Demonstrating the power of visual programming interfaces
- **Algorithm Implementation**: Understanding how ML algorithms work under the hood
- **Data Science Workflow**: Best practices for building end-to-end ML pipelines

## 🔧 Customization

### Adding New Algorithms
1. Create a new Python file in the `algorithms/` directory
2. Implement your algorithm following the existing pattern
3. Add the algorithm to the frontend toolbar in `canvas.js`
4. Update the Flask routes in `app.py` to handle the new algorithm

### Adding Preprocessing Steps
1. Create a new Python file in the `preprocessing/` directory
2. Implement your preprocessing function
3. Add UI elements to the frontend
4. Connect the backend logic through Flask routes

## 🤝 Contributing

We welcome contributions! Please feel free to:
- Report bugs and issues
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is open-source and available under the MIT License.

## 🙏 Acknowledgments

- Built with Flask for the backend framework
- Uses vanilla JavaScript for maximum compatibility
- Inspired by modern no-code/low-code platforms
- Educational implementation of classic ML algorithms

---

**Start building ML pipelines visually today! 🚀**
