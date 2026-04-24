class DecisionTree:
    def __init__(self, max_depth=5):
        self.max_depth = max_depth
        self.tree = None

    class Node:
        def __init__(self, feature_index=None, threshold=None, left=None, right=None, value=None):
            self.feature_index = feature_index
            self.threshold = threshold
            self.left = left
            self.right = right
            self.value = value  # Leaf node value (class label)

    def fit(self, X, y):
        # Convert 1D list to 2D for consistent processing
        if X and isinstance(X[0], (int, float)):
            X2 = [[x] for x in X]
        else:
            X2 = X
        
        # Combine X and y
        dataset = [row + [label] for row, label in zip(X2, y)]
        self.tree = self._build_tree(dataset, depth=0)

    def _gini(self, groups, classes):
        # Count all samples at split point
        n_instances = float(sum([len(group) for group in groups]))
        gini = 0.0
        for group in groups:
            size = float(len(group))
            if size == 0:
                continue
            score = 0.0
            # score the group based on the score for each class
            for class_val in classes:
                p = [row[-1] for row in group].count(class_val) / size
                score += p * p
            # weight the group score by its relative size
            gini += (1.0 - score) * (size / n_instances)
        return gini

    def _test_split(self, index, value, dataset):
        left, right = list(), list()
        for row in dataset:
            if row[index] < value:
                left.append(row)
            else:
                right.append(row)
        return left, right

    def _get_split(self, dataset):
        class_values = list(set(row[-1] for row in dataset))
        b_index, b_value, b_score, b_groups = 999, 999, 999, None
        
        # Check all features
        n_features = len(dataset[0]) - 1
        for index in range(n_features):
            for row in dataset:
                groups = self._test_split(index, row[index], dataset)
                gini = self._gini(groups, class_values)
                if gini < b_score:
                    b_index, b_value, b_score, b_groups = index, row[index], gini, groups
        return {'index': b_index, 'value': b_value, 'groups': b_groups}

    def _to_terminal(self, group):
        outcomes = [row[-1] for row in group]
        return max(set(outcomes), key=outcomes.count)

    def _split(self, node, max_depth, min_size, depth):
        left, right = node['groups']
        del(node['groups'])
        
        # check for a no split
        if not left or not right:
            node['left'] = node['right'] = self._to_terminal(left + right)
            return
        
        # check for max depth
        if depth >= max_depth:
            node['left'], node['right'] = self._to_terminal(left), self._to_terminal(right)
            return
        
        # process left child
        if len(left) <= min_size:
            node['left'] = self._to_terminal(left)
        else:
            node['left'] = self._get_split(left)
            self._split(node['left'], max_depth, min_size, depth+1)
            
        # process right child
        if len(right) <= min_size:
            node['right'] = self._to_terminal(right)
        else:
            node['right'] = self._get_split(right)
            self._split(node['right'], max_depth, min_size, depth+1)

    def _build_tree(self, train, depth):
        root = self._get_split(train)
        self._split(root, self.max_depth, 1, 1)
        return root

    def _predict_row(self, node, row):
        # Recursive prediction logic that matches structure returned by _build_tree
        # If node is a terminal value (class label), return it.
        # But _split replaces 'left'/'right' with dicts OR values.
        # Wait, Python is dynamic. Need to check type.
        
        # If node is a leaf value directly? No, structure is dictionary unless replaced.
        # Check if node is dict
        if not isinstance(node, dict):
             return node
             
        if row[node['index']] < node['value']:
            if isinstance(node['left'], dict):
                return self._predict_row(node['left'], row)
            else:
                return node['left']
        else:
            if isinstance(node['right'], dict):
                return self._predict_row(node['right'], row)
            else:
                return node['right']

    def predict(self, X):
        # Handle 1D
        if X and isinstance(X[0], (int, float)):
            X2 = [[x] for x in X]
        else:
            X2 = X
            
        predictions = []
        for row in X2:
            predictions.append(self._predict_row(self.tree, row))
        return predictions
