document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const blocks = []; // { id, type, x, y, element }
    let connections = []; // { from: id, to: id }
    let blockIdCounter = 1;
    let connectionSource = null;
    let selectedBlockId = null;
    let selectedConnection = null; // { from: id, to: id }
    let testDatasetsModal = null;

    // --- Initialize Test Datasets Modal ---
    initializeTestDatasetsModal();

    // --- DOM Elements ---
    const canvasArea = document.getElementById('canvas-area');
    const svgLayer = document.getElementById('connections-layer');
    const explanationPanel = document.getElementById('explanation-content');
    // connectionBtn removed
    const datasetUpload = document.getElementById('dataset-upload');
    const datasetInfo = document.getElementById('dataset-info');
    const datasetStats = document.getElementById('dataset-stats');
    const placeholder = document.querySelector('.canvas-placeholder');
    
    // Create Delete Connection Overlay
    const deleteConnBtn = document.createElement('button');
    deleteConnBtn.innerHTML = '❌ Delete';
    deleteConnBtn.style.position = 'absolute';
    deleteConnBtn.style.display = 'none';
    deleteConnBtn.style.zIndex = '1000';
    deleteConnBtn.style.backgroundColor = 'white';
    deleteConnBtn.style.border = '1px solid #ccc';
    deleteConnBtn.style.padding = '4px 8px';
    deleteConnBtn.style.cursor = 'pointer';
    deleteConnBtn.style.borderRadius = '4px';
    deleteConnBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    deleteConnBtn.style.fontSize = '0.8em';
    
    canvasArea.appendChild(deleteConnBtn);
    
    // Hide controls when clicking empty space
    canvasArea.addEventListener('click', (e) => {
        // If not clicking on a line (handled by line click) or the button itself
        if (e.target.tagName !== 'line' && e.target !== deleteConnBtn) {
            deselectConnection();
        }
    });
    
    deleteConnBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSelectedConnection();
    });
    
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConnection) {
            deleteSelectedConnection();
        }
    });

    // --- Explanations ---
    const explanations = {
        'dataset': "Dataset: The foundation of your model. Contains the training examples (features and targets).",
        
        // Preprocessing
        'missing_value_handling': "Missing Value Handling: Imputes or removes missing data points to ensure the algorithm can process the dataset.",
        'normalization': "Normalization: Scales data to a range (usually 0-1) so all features contribute equally.",
        'standardization': "Standardization: Scales data to have a mean of 0 and standard deviation of 1.",
        'feature_selection': "Feature Selection: Selects the most relevant features to improve model performance and reduce overfitting.",

        // Algorithms
        'linear_regression': "Linear Regression: Finds the best fitting straight line between input features and the target variable.",
        'logistic_regression': "Logistic Regression: Used for classification tasks to predict the probability of an outcome.",
        'knn': "K-Nearest Neighbors: Classifies a data point based on how its neighbors are classified.",
        'decision_tree': "Decision Tree: A tree-like model of decisions and their possible consequences."
    };

    // --- Resize SVG Helper ---
    function resizeSVG() {
        if (!canvasArea || !svgLayer) return;
        svgLayer.style.width = '100%';
        svgLayer.style.height = '100%';
        // Also update viewBox if we were using it, but here we just use absolute pixels
    }
    window.addEventListener('resize', resizeSVG);
    resizeSVG();

    // --- Dynamic Drag Events (Delegate) ---
    // Since we add dataset blocks dynamically, we can't just use current querySelectorAll.
    // Instead, we attach 'dragstart' to the document or handle it on creation.
    // Let's use a function to attach listeners to new elements, or simplest: use Event Delegation for 'dragstart' if possible? 
    // HTML5 DragStart bubbles, so we can listen on document.
    
    document.addEventListener('dragstart', (e) => {
        // Need to check target or its parent because inner elements might be clicked
        const target = e.target.closest('.block-item');
        if (target) {
            e.dataTransfer.setData('type', target.dataset.type);
            e.dataTransfer.setData('method', target.dataset.method || ''); 
            
            // For dataset blocks, text might contain rows/cols, we want just the name
            if(target.dataset.type === 'dataset') {
                 e.dataTransfer.setData('text', target.dataset.name);
                 e.dataTransfer.setData('dataset_name', target.dataset.name);
            } else {            
                 e.dataTransfer.setData('text', target.innerText.trim());
            }
        }
    });

    // Old static attachment removed in favor of delegation above
    // const draggables = document.querySelectorAll...

    canvasArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvasArea.style.backgroundColor = '#ecf0f1';
    });

    canvasArea.addEventListener('dragleave', () => {
        canvasArea.style.backgroundColor = '#f5f5f5';
    });
    
    // Allow drop on canvas area
    canvasArea.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasArea.style.backgroundColor = '#f5f5f5';
        
        const type = e.dataTransfer.getData('type');
        const method = e.dataTransfer.getData('method');
        const text = e.dataTransfer.getData('text');
        const dataset_name = e.dataTransfer.getData('dataset_name');
        
        if (type) {
            // Get drop position relative to canvas
            const rect = canvasArea.getBoundingClientRect();
            const x = e.clientX - rect.left - 100; // Center offset
            const y = e.clientY - rect.top - 25;
            
            createBlock(type, method, text, x, y, dataset_name);
        }
    });

    // --- Helper Functions ---
    function getBlockDisplayName(type, method, label, dataset_name) {
        if (type === 'dataset') {
            return dataset_name || 'Dataset';
        } else if (type === 'preprocess') {
            return method ? method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Preprocessing';
        } else if (type === 'algorithm') {
            return method ? method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Algorithm';
        }
        return label || 'Block';
    }

    // --- Block Creation ---
    // Added options parameter to support exported block customization
    function createBlock(type, method, label, x, y, dataset_name = null, options = {}) {
        if (placeholder) placeholder.style.display = 'none';

        const id = `block_${blockIdCounter++}`;
        
        const blockEl = document.createElement('div');
        blockEl.classList.add('canvas-block');
        if (type) blockEl.classList.add(type); // .preprocess, .algorithm, .dataset

        // Handle exported style
        if (options.isExported) {
             blockEl.classList.add('exported-dataset');
        }

        blockEl.dataset.type = type;
        method = method || ''; 
        blockEl.dataset.method = method;
        blockEl.dataset.id = id;
        if(dataset_name) blockEl.dataset.datasetName = dataset_name;
        
        // Initial positioning
        blockEl.style.left = `${Math.max(0, x)}px`;
        blockEl.style.top = `${Math.max(0, y)}px`;
        
        // Content
        let icon = '';
        if (type === 'dataset') {
            blockEl.classList.add('dataset'); // Explicit class for CSS
            
            // Default dataset styles (unless exported override is applied via options.isExported class)
            if (!options.isExported) {
                blockEl.style.background = '#fff3e0';
                blockEl.style.borderColor = '#ff9800';
                blockEl.style.color = '#e65100';
            }
            
            icon = '<i class="fas fa-database"></i>';
            label = `Dataset<div style="font-size:0.8em; color:#333;">${dataset_name}</div>`;
            
            // Add Configuration Arrow Button (only for dataset)
            const configBtn = document.createElement('button');
            configBtn.className = 'dataset-config-btn';
            configBtn.innerHTML = '▼';
            configBtn.title = "Configure Dataset";
            configBtn.style.cssText = 'position:absolute; right:5px; bottom:5px; border:none; background:transparent; font-size:12px; cursor:pointer; color:#e65100;';
            
            configBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent block selection
                openDatasetConfig(id, dataset_name);
            });
            
            // Append later after block content set
            // Wait, we set innerHTML below which overwrites.
            // We need to append it after or include in innerHTML.
        } else if (type === 'preprocess') {
            blockEl.style.backgroundColor = '#e3f2fd'; // Light Blue
            blockEl.style.borderColor = '#2196f3';
            blockEl.style.color = '#0d47a1';
            icon = '<i class="fas fa-cogs"></i>';
        } else if (type === 'algorithm') {
            blockEl.style.backgroundColor = '#e8f5e9'; // Light Green
            blockEl.style.borderColor = '#4caf50';
            blockEl.style.color = '#1b5e20';
            icon = '<i class="fas fa-brain"></i>';
        }

        blockEl.innerHTML = `
            ${icon} <strong>${getBlockDisplayName(type, method, label, dataset_name)}</strong>
            <div style="font-size: 0.8em; margin-top: 5px;" class="block-subtitle">${type === 'algorithm' ? 'Algorithm' : (type === 'preprocess' ? 'Preprocessing' : '')}</div>
        `;
        
        // Add Dataset Config Button (Appended after innerHTML set)
        if (type === 'dataset') {
             const configBtn = document.createElement('button');
             configBtn.innerHTML = '<i class="fas fa-cog"></i>';
             configBtn.title = "Configure Dataset";
             // simple styling
             configBtn.style.cssText = 'position:absolute; right:5px; bottom:5px; border:none; background:transparent; font-size:14px; cursor:pointer; color:#e65100; opacity:0.7;';
             configBtn.onmouseover = () => configBtn.style.opacity = '1';
             configBtn.onmouseout = () => configBtn.style.opacity = '0.7';

             configBtn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 openDatasetConfig(id, dataset_name);
             });
             blockEl.appendChild(configBtn);
        }

        // Add Preprocessing Config Button
        if (type === 'preprocess') {
             const method = blockEl.dataset.method;
             
             const configBtn = document.createElement('button');
             configBtn.innerHTML = '▼';
             
             let tooltip = "Select Columns";
             if (method === 'categorical_encoder') tooltip = "Configure Mapping";
             if (method === 'value_standardizer') tooltip = "Standardize Values";
             if (method === 'missing_value_handling') tooltip = "Configure Missing Value Strategy";
             
             configBtn.title = tooltip;
             configBtn.className = "preprocess-config-btn"; 
             configBtn.style.cssText = 'position:absolute; right:5px; bottom:5px; border:none; background:transparent; font-size:16px; cursor:pointer; color:#0d47a1; opacity:0.7; font-weight:bold;';
             configBtn.onmouseover = () => configBtn.style.opacity = '1';
             configBtn.onmouseout = () => configBtn.style.opacity = '0.7';

             configBtn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 if (method === 'categorical_encoder') {
                    openCategoricalConfig(id);
                 } else if (method === 'value_standardizer') {
                    openStandardizerConfig(id);
                 } else if (method === 'missing_value_handling') {
                    openMissingValueConfig(id);
                 } else {
                    openPreprocessingConfig(id);
                 }
             });
             blockEl.appendChild(configBtn);
        }

        // Add Delete Button
        const delBtn = document.createElement('button');
        delBtn.classList.add('delete-block-btn');
        delBtn.innerHTML = '<i class="fas fa-times"></i>';
        delBtn.title = "Delete Block";
        
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent selection
            deleteBlock(id);
        });
        
        blockEl.appendChild(delBtn);

        canvasArea.appendChild(blockEl);

        // Store in state
        const blockObj = {
            id: id,
            type: type,
            datasetFileName: dataset_name,
            // Store dataset specific stats if available on the DOM element source?
            // Since we get just name here, we might not have rows/cols unless we look them up
            // or pass them in createBlock. For now name is sufficient for backend.
            x: x,
            y: y,
            element: blockEl
        };
        blocks.push(blockObj);

        // Events
        blockEl.addEventListener('mousedown', (e) => handleBlockMouseDown(e, blockObj));
        blockEl.addEventListener('click', (e) => handleBlockClick(e, blockObj));
        
        // Context Menu (Right Click Delete)
        blockEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            deleteBlock(id);
        });

        // Double Click for Dataset Viewer
        if (type === 'dataset') {
            blockEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                openDatasetViewer(blockObj.datasetFileName);
            });
        }

        selectBlock(id);
    }
    
    // --- Deletion Logic ---
    function deleteBlock(id) {
        // Remove from DOM
        const blockIndex = blocks.findIndex(b => b.id === id);
        if (blockIndex > -1) {
            const block = blocks[blockIndex];
            block.element.remove();
            blocks.splice(blockIndex, 1);
        }
        
        // Remove associated connections
        // Iterate backwards safely
        for (let i = connections.length - 1; i >= 0; i--) {
            if (connections[i].from === id || connections[i].to === id) {
                connections.splice(i, 1);
            }
        }
        
        // Redraw connections
        drawConnections();
        
        // Reset selection if needed
        if (selectedBlockId === id) {
            selectedBlockId = null;
            explanationPanel.innerHTML = '<p>Select a block to see its description.</p>';
        }
    }
    
    // Keyboard Deletion
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
            deleteBlock(selectedBlockId);
        }
    });

    // --- Interaction Handlers ---

    function handleBlockClick(e, blockObj) {
        e.stopPropagation();

        // Check for CTRL key press for connection logic
        if (e.ctrlKey || e.metaKey) { // Support Command key on Mac too
            handleConnectionAttempt(blockObj.id);
        } else {
            // Normal selection
            selectBlock(blockObj.id);
            // If we were in the middle of a connection attempt and user clicked without CTRL, cancel it
            if (connectionSource) {
                const srcBlock = blocks.find(b => b.id === connectionSource);
                if (srcBlock) srcBlock.element.classList.remove('connection-source');
                connectionSource = null;
            }
        }
    }

    function handleBlockMouseDown(e, blockObj) {
        // If CTRL is pressed, we don't drag, we might be preparing to click for connection
        if (e.ctrlKey || e.metaKey) return; 

        // Prevent text selection
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = blockObj.x;
        const startTop = blockObj.y;
        
        const rect = canvasArea.getBoundingClientRect();
        
        function onMouseMove(moveEvent) {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            
            let newX = startLeft + dx;
            let newY = startTop + dy;
            
            // Constrain
            newX = Math.max(0, Math.min(newX, canvasArea.clientWidth - blockObj.element.offsetWidth));
            newY = Math.max(0, Math.min(newY, canvasArea.clientHeight - blockObj.element.offsetHeight));
            
            blockObj.element.style.left = `${newX}px`;
            blockObj.element.style.top = `${newY}px`;
            
            blockObj.x = newX;
            blockObj.y = newY;
            
            drawConnections();
        }
        
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    // --- Block Selection ---
    function selectBlock(id) {
        // Track current selection
        selectedBlockId = id;

        document.querySelectorAll('.canvas-block').forEach(b => b.classList.remove('selected'));
        const blockObj = blocks.find(b => b.id === id);
        if (blockObj) {
            blockObj.element.classList.add('selected');
            
            const type = blockObj.type;
            const method = blockObj.element.dataset.method;
            
            // Use method for lookup if available, otherwise type (for dataset)
            const lookupKey = method || type;
            const text = explanations[lookupKey] || "No description available.";
            
            // Format title: "Normalization Block" or "Linear_regression Block" -> "Linear Regression Block"
            let title = method ? method.replace(/_/g, ' ') : type;
            title = title.split(' ').map(bold => bold.charAt(0).toUpperCase() + bold.slice(1)).join(' ');
            
            explanationPanel.innerHTML = `
                <div class="explanation-title">${title} Block</div>
                <p>${text}</p>
            `;
            
            // Expose the function to window scope for onclick usage (hacky but works for inline button)
            window.deleteBlock = deleteBlock;
            
            if (type === 'dataset') {
                 // Add specific dataset info
                 const p = document.createElement('p');
                 p.innerHTML = `<strong>File:</strong> ${blockObj.datasetFileName || 'Unknown'}`;
                 explanationPanel.appendChild(p);
                 
                 // Clear visualization tab for dataset
                 const vizContainer = document.getElementById('preprocessing-visualizations');
                 if (vizContainer) {
                     vizContainer.innerHTML = '';
                 }
                 
                 // --- Fix: Update Dataset Stats Panel ---
                 
                 // Get references
                 const datasetInfo = document.getElementById('dataset-info');
                 const datasetStats = document.getElementById('dataset-stats');
                 
                 if (datasetInfo && datasetStats) {
                     datasetInfo.style.display = 'block';
                     datasetStats.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading dataset...';
                 }

                 // Fetch and Visualize
                 if (blockObj.datasetFileName) {
                     console.log("Fetching dataset:", blockObj.datasetFileName);
                     fetch(`/get_dataset?name=${blockObj.datasetFileName}`)
                     .then(res => res.json())
                     .then(data => {
                         if(data.rows) {
                             // Update Visualization Table
                             renderTable(data);
                             
                             // Update Stats Panel
                             if (datasetStats) {
                                 // 1. Overview Card
                                 const rowCount = data.total_rows || data.rows.length;
                                 const colCount = data.columns ? data.columns.length : 0;
                                 
                                 let html = `
                                     <div class="stats-card">
                                         <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Dataset Overview</h4>
                                         <table class="stats-table">
                                             <tr><td><strong>Rows</strong></td><td>${rowCount}</td></tr>
                                             <tr><td><strong>Columns</strong></td><td>${colCount}</td></tr>
                                         </table>
                                     </div>
                                 `;

                                 // 2. Column Details Card
                                 if (data.column_stats) {
                                     html += `<div class="stats-card">
                                         <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Column Details</h4>
                                         <div style="max-height: 300px; overflow-y: auto;">
                                     `;
                                     
                                     // Iterate over ARRAY of stats
                                     data.column_stats.forEach(stats => {
                                         const colName = stats.name;
                                         
                                         // Determine icon/color based on type
                                         const typeColor = stats.type === 'Numeric' ? '#3498db' : '#e67e22'; // Blue for Num, Orange for Cat
                                         const typeLabel = stats.type === 'Numeric' ? 'Num' : 'Cat';

                                         html += `
                                             <div style="margin-bottom: 15px; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px;">
                                                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                                     <strong style="color: #2c3e50;">${colName}</strong>
                                                     <span style="background-color:${typeColor}; color:white; padding:2px 6px; border-radius:4px; font-size:0.75em;">${typeLabel}</span>
                                                 </div>
                                                 <table class="stats-table" style="font-size: 0.85em;">
                                         `;
                                         
                                         // Render stats based on type
                                         if (stats.type === 'Numeric') {
                                             html += `
                                                 <tr><td>Min</td><td>${stats.min}</td></tr>
                                                 <tr><td>Max</td><td>${stats.max}</td></tr>
                                                 <tr><td>Mean</td><td>${stats.mean}</td></tr>
                                                 ${stats.unique ? `<tr><td>Unique</td><td>${stats.unique}</td></tr>` : ''}
                                             `;
                                         } else {
                                              html += `
                                                 <tr><td>Unique</td><td>${stats.unique || '-'}</td></tr>
                                                 <tr><td>Top</td><td>${stats.top || '-'}</td></tr>
                                                 <tr><td>Freq</td><td>${stats.freq || '-'}</td></tr>
                                              `;
                                         }

                                         // Missing values (common to both)
                                         if (stats.missing > 0) {
                                              html += `<tr><td style="color: #e74c3c;">Missing</td><td style="color: #e74c3c;">${stats.missing}</td></tr>`;
                                         }
                                         
                                         html += `</table></div>`;
                                     });
                                     html += `</div></div>`; // Close container and card
                                 }
                                 
                                 datasetStats.innerHTML = html;
                             }
                             
                             // Optional: Switch to Visualization tab automatically?
                             // User didn't explicitly ask for auto-switch on click, but "click... shows dataset"
                             // Keeping it in stats panel satisfies "stats panel shows..."
                         } else {
                             if (datasetStats) datasetStats.innerHTML = "Dataset empty or invalid.";
                         }
                     })
                     .catch(err => {
                         console.error(err);
                         if (datasetStats) datasetStats.innerHTML = `<span style="color:red">Failed to load dataset.</span>`;
                     });
                 }
            } else if (type === 'preprocess') {
                 // Show preprocessing-specific information
                 const config = blockObj.config || {};
                 const p = document.createElement('div');
                 p.style.marginTop = '10px';
                 
                 let configHtml = '<div style="background:#f8f9fa; padding:20px; border-radius:5px; border-left:4px solid #f1c40f; border:2px solid #f1c40f;">';
                 configHtml += '<h4 style="margin-top:0; color:#d68910; font-weight:900; font-size:1.3em;">Configuration</h4>';
                 
                 // Default strategy for missing value handling is mean
                 const strategy = config.strategy || 'mean';
                 
                 if (method === 'missing_value_handling') {
                     configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Strategy:</strong> ${strategy.charAt(0).toUpperCase() + strategy.slice(1)}</p>`;
                     if (config.columns && config.columns.length > 0) {
                         configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Columns:</strong> ${config.columns.join(', ')}</p>`;
                     }
                     if (strategy === 'custom' && config.customValue) {
                         configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Custom Value:</strong> ${config.customValue}</p>`;
                     }
                 } else if (method === 'categorical_encoder') {
                     configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Column:</strong> ${config.column || 'Not configured'}</p>`;
                     if (config.mapping) {
                         const mappingCount = Object.keys(config.mapping).length;
                         configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Mapping Count:</strong> ${mappingCount}</p>`;
                     }
                 } else if (method === 'value_standardizer') {
                     configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Column:</strong> ${config.column || 'Not configured'}</p>`;
                     if (config.mapping) {
                         const mappingCount = Object.keys(config.mapping).length;
                         configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Fixes Applied:</strong> ${mappingCount}</p>`;
                     }
                 } else {
                     if (config.columns && config.columns.length > 0) {
                         configHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#d68910;">Selected Columns:</strong> ${config.columns.join(', ')}</p>`;
                     }
                 }
                 
                 configHtml += '</div>';
                 p.innerHTML = configHtml;
                 explanationPanel.appendChild(p);
                 
                 // Check if pipeline has been run and this block has results
                 const pipelineResults = window.pipelineResults || {};
                 const blockResults = pipelineResults[id];
                 
                 if (blockResults && method === 'missing_value_handling') {
                     // Show the affected column with before/after data
                     const vizContainer = document.getElementById('preprocessing-visualizations');
                     if (vizContainer) {
                         const createColumnTable = (rows, headers) => {
                             if (!rows || rows.length === 0) return '<div style="padding:10px; color:#999; text-align:center;">No data available</div>';
                             let html = '<table style="width:100%; font-size: 0.85rem; border-collapse: collapse;"><thead><tr style="background:#f9f9f9;">';
                             headers.forEach(h => html += `<th style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:700; color:#333;">${h}</th>`);
                             html += '</tr></thead><tbody>';
                             rows.forEach(row => {
                                 html += '<tr>';
                                 row.forEach(val => {
                                     let displayVal = val;
                                     if (typeof val === 'number') displayVal = parseFloat(val.toFixed(4));
                                     else if (val === null || val === undefined) displayVal = '<span style="color:#e74c3c; font-weight:700;">NaN</span>';
                                     else if (val === '') displayVal = '<span style="color:#e74c3c; font-weight:700;">Empty</span>';
                                     html += `<td style="padding:8px; border:1px solid #ddd; text-align:center;">${displayVal}</td>`;
                                 });
                                 html += '</tr>';
                             });
                             html += '</tbody></table>';
                             return html;
                         };
                         
                         const beforeHTML = createColumnTable(blockResults.before, blockResults.headers);
                         const afterHTML = createColumnTable(blockResults.after, blockResults.headers);
                         
                         vizContainer.innerHTML = `
                            <div style="background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:20px; border-radius:8px;">
                                <h4 style="margin:0 0 15px 0; font-weight:900; font-size:1.2em; color:#856404;">
                                    <i class="fas fa-magic" style="margin-right:10px;"></i>Missing Value Transformation
                                </h4>
                                <div style="display:flex; gap:20px; align-items:flex-start;">
                                    <div style="flex:1; border:2px solid #e0e0e0; border-radius:8px; padding:0; background:white;">
                                        <div style="background:#f8f9fa; padding:12px; border-bottom:2px solid #e0e0e0; text-align:center; font-weight:900; color:#666; font-size:1.05em;">Before</div>
                                        <div style="padding:15px; overflow-x:auto;">${beforeHTML}</div>
                                    </div>
                                    <div style="flex:0 0 30px; display:flex; align-items:center; justify-content:center; color:#d68910; font-size:2em;">
                                        <i class="fas fa-arrow-right"></i>
                                    </div>
                                    <div style="flex:1; border:2px solid #28a745; border-radius:8px; padding:0; background:white;">
                                        <div style="background:#d4edda; padding:12px; border-bottom:2px solid #28a745; text-align:center; font-weight:900; color:#155724; font-size:1.05em;">After</div>
                                        <div style="padding:15px; overflow-x:auto;">${afterHTML}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                     }
                     
                     // Clear the data table in Visualization tab
                     const tableHeader = document.getElementById('table-header');
                     const tableBody = document.getElementById('table-body');
                     if (tableHeader) tableHeader.innerHTML = '<th>Column Transformation Preview</th>';
                     if (tableBody) tableBody.innerHTML = '<tr><td style="text-align:center; padding:20px; color:#666;">See transformation above</td></tr>';
                 } else {
                     // Clear the data table in Visualization tab
                     const tableHeader = document.getElementById('table-header');
                     const tableBody = document.getElementById('table-body');
                     if (tableHeader) tableHeader.innerHTML = '<th>No Data Available</th>';
                     if (tableBody) tableBody.innerHTML = '';
                     
                     // Update Visualization tab for preprocessing
                     const vizContainer = document.getElementById('preprocessing-visualizations');
                     if (vizContainer) {
                         vizContainer.innerHTML = `
                             <div style="background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:20px; border-radius:8px; text-align:center;">
                                 <i class="fas fa-cogs" style="font-size:3em; margin-bottom:15px;"></i>
                                 <h4 style="margin:0 0 10px 0;">Preprocessing Configuration</h4>
                                 <p style="margin:0;">Run the pipeline to see before/after transformations.</p>
                                 <p style="margin:10px 0 0 0; font-size:0.9em; color:#666;">Configure this block by clicking the ▼ button on the block.</p>
                             </div>
                         `;
                     }
                 }
                 
                 // Hide dataset info panel
                 const datasetInfo = document.getElementById('dataset-info');
                 if (datasetInfo) datasetInfo.style.display = 'none';
                 
            } else if (type === 'model' || type === 'algorithm') {
                 // Show algorithm-specific information
                 const p = document.createElement('div');
                 p.style.marginTop = '10px';
                 
                 let algoHtml = '<div style="background:#f8f9fa; padding:20px; border-radius:5px; border-left:4px solid #9b59b6; border:2px solid #9b59b6;">';
                 algoHtml += '<h4 style="margin-top:0; color:#8e44ad; font-weight:900; font-size:1.3em;">Algorithm Details</h4>';
                 
                 if (method === 'linear_regression') {
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Type:</strong> Regression</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Input:</strong> Single numerical feature</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Output:</strong> Continuous numerical value</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Method:</strong> Gradient Descent</p>`;
                 } else if (method === 'logistic_regression') {
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Type:</strong> Binary Classification</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Input:</strong> Single numerical feature</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Output:</strong> Binary class (0 or 1)</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Method:</strong> Sigmoid Activation + Gradient Descent</p>`;
                 } else if (method === 'knn') {
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Type:</strong> Classification (K-Nearest Neighbors)</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Input:</strong> Numerical features (1-2 recommended for visualization)</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Output:</strong> Class label</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Method:</strong> Distance-based voting</p>`;
                 } else if (method === 'decision_tree') {
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Type:</strong> Classification (Decision Tree)</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Input:</strong> Numerical features (1-2 recommended for visualization)</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Output:</strong> Class label</p>`;
                     algoHtml += `<p style="margin:10px 0; font-size:1.05em; color:#333;"><strong style="font-weight:900; color:#8e44ad;">Method:</strong> Recursive binary splitting with Gini impurity</p>`;
                 }
                 
                 algoHtml += '</div>';
                 p.innerHTML = algoHtml;
                 explanationPanel.appendChild(p);
                 
                 // Clear the data table in Visualization tab
                 const tableHeader = document.getElementById('table-header');
                 const tableBody = document.getElementById('table-body');
                 if (tableHeader) tableHeader.innerHTML = '<th>No Data Available</th>';
                 if (tableBody) tableBody.innerHTML = '';
                 
                 // Update Visualization tab for algorithms
                 const vizContainer = document.getElementById('preprocessing-visualizations');
                 if (vizContainer) {
                     vizContainer.innerHTML = `
                        <div style="background:#e8f4f8; border:1px solid #b8daff; color:#004085; padding:20px; border-radius:8px; text-align:center;">
                            <i class="fas fa-chart-line" style="font-size:3em; margin-bottom:15px;"></i>
                            <h4 style="margin:0 0 10px 0;">Algorithm Visualization</h4>
                            <p style="margin:0;">Run the pipeline to see algorithm results and graphs.</p>
                            <p style="margin:10px 0 0 0; font-size:0.9em; color:#666;">Connect this block to a dataset and run the pipeline.</p>
                        </div>
                    `;
                 }
                 
                 // Hide dataset info panel
                 const datasetInfo = document.getElementById('dataset-info');
                 if (datasetInfo) datasetInfo.style.display = 'none';
            } else {
                 // For other block types, hide the dataset info panel
                 const datasetInfo = document.getElementById('dataset-info');
                 if (datasetInfo) datasetInfo.style.display = 'none';
                 
                 // Clear the data table in Visualization tab
                 const tableHeader = document.getElementById('table-header');
                 const tableBody = document.getElementById('table-body');
                 if (tableHeader) tableHeader.innerHTML = '<th>No Data Available</th>';
                 if (tableBody) tableBody.innerHTML = '';
                 
                 // Clear visualization tab
                 const vizContainer = document.getElementById('preprocessing-visualizations');
                 if (vizContainer) {
                     vizContainer.innerHTML = '';
                 }
            }
        } else {
                 // Re-append dataset stats if available
                 if (datasetInfo.style.display !== 'none') {
                     explanationPanel.appendChild(datasetInfo);
                 }
            }
        }

    // --- Connection Logic (Ctrl + Click) ---
    // connectionBtn listener removed

    function handleConnectionAttempt(id) {
        if (!connectionSource) {
            // FIRST CLICK: Set Source
            connectionSource = id;
            const blockObj = blocks.find(b => b.id === id);
            blockObj.element.classList.add('connection-source'); // CSS class for highlighting
            
            // Show brief toast or log?
            console.log("Source selected. Ctrl+Click target to connect.");
        } else {
            // SECOND CLICK: Set Target
            if (connectionSource !== id) {
                // Check duplicate
                const exists = connections.some(c => 
                    (c.from === connectionSource && c.to === id)
                );
                
                // Prevent duplicate and allow strictly directional (Source -> Target)
                if (!exists) {
                    connections.push({ from: connectionSource, to: id });
                    drawConnections();
                }
            } else {
                 // Clicked same block twice (Self-connection attempt or cancel)
                 console.log("Cannot connect block to itself.");
            }
            
            // Reset Source
            const srcBlock = blocks.find(b => b.id === connectionSource);
            if (srcBlock) srcBlock.element.classList.remove('connection-source');
            
            connectionSource = null;
        }
    }

    function drawConnections() {
        // Keep defs only
        const defs = svgLayer.querySelector('defs');
        // Clear everything else
        while (svgLayer.lastChild && svgLayer.lastChild !== defs) {
            svgLayer.removeChild(svgLayer.lastChild);
        }

        connections.forEach(conn => {
            const b1 = blocks.find(b => b.id === conn.from);
            const b2 = blocks.find(b => b.id === conn.to);
            if (!b1 || !b2) return;

            // Calculate centers
            const x1 = b1.x + b1.element.offsetWidth / 2;
            const y1 = b1.y + b1.element.offsetHeight / 2;
            const x2 = b2.x + b2.element.offsetWidth / 2;
            const y2 = b2.y + b2.element.offsetHeight / 2;

            const isSelected = selectedConnection && 
                               (selectedConnection.from === conn.from) && 
                               (selectedConnection.to === conn.to);

            // Group for easier selection
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.style.pointerEvents = "all";
            
            // 1. Transparent wide 'hit' line for easier clicking
            const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hitLine.setAttribute("x1", x1);
            hitLine.setAttribute("y1", y1);
            hitLine.setAttribute("x2", x2);
            hitLine.setAttribute("y2", y2);
            hitLine.setAttribute("stroke", "transparent");
            hitLine.setAttribute("stroke-width", "15"); // Wide hit area
            hitLine.style.cursor = "pointer";
            
            // 2. Visible Line
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            
            if (isSelected) {
                line.setAttribute("stroke", "#e74c3c");
                line.setAttribute("stroke-width", "3");
                // Optional: add drop shadow or glow via filter
            } else {
                line.setAttribute("stroke", "#333");
                line.setAttribute("stroke-width", "2");
            }
            
            line.setAttribute("marker-end", "url(#arrowhead)");
            line.style.pointerEvents = "none"; // Pass events to hitLine
            
            // Add interaction
            hitLine.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop reaching canvas click
                selectConnection(conn, e.clientX, e.clientY, x1, y1, x2, y2);
            });
            
            hitLine.addEventListener('mouseover', () => {
                line.setAttribute("stroke-width", isSelected ? "4" : "3");
            });
            
            hitLine.addEventListener('mouseout', () => {
                line.setAttribute("stroke-width", isSelected ? "3" : "2");
            });
            
            hitLine.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Select and delete immediately
                selectedConnection = conn;
                drawConnections();
                deleteSelectedConnection();
            });
            
            g.appendChild(hitLine);
            g.appendChild(line);
            svgLayer.appendChild(g);
        });
    }

    // --- Connection Manipulation Logic ---
    
    function selectConnection(conn, clientX, clientY, x1, y1, x2, y2) {
        selectedConnection = conn;
        drawConnections(); // Re-render for highlight
        
        // Show delete button at midpoint of line, relative to canvas
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        deleteConnBtn.style.display = 'block';
        deleteConnBtn.style.left = (midX - 30) + 'px'; 
        deleteConnBtn.style.top = (midY - 25) + 'px';
        
        // Re-bind click is risky if we add multiple listeners.
        // It's better to update state, and main delete handler uses state.
    }
    
    function deleteSelectedConnection() {
        if (!selectedConnection) return;
        
        const index = connections.findIndex(c => c.from === selectedConnection.from && c.to === selectedConnection.to);
        if (index > -1) {
            connections.splice(index, 1);
        }
        
        deselectConnection(); // This clears state and redraws
    }

    function deselectConnection() {
        selectedConnection = null;
        drawConnections();
        if (deleteConnBtn) deleteConnBtn.style.display = 'none';
    }

    // --- Dataset Upload ---
    datasetUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset UI feedback
        datasetStats.innerText = "Uploading...";
        datasetInfo.style.display = 'block';

        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload_dataset', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`Dataset Uploaded!\nRows: ${data.rows}`);
                
                // datasetStats.innerHTML = `${data.rows} rows, ${data.columns} columns loaded.`;
                
                // New logic: Add to library instead of canvas
                addDatasetToLibrary(data.dataset_name, data.rows, data.columns);

                // Create Block (Removed - now manual drag)
                // createBlock('dataset', '', 'Dataset', 50, 50);
                
                alert(`Dataset '${data.dataset_name}' added to Library.\nDrag it onto the canvas to use.`);
            } else {
                alert('Upload Error: ' + data.error);
                datasetStats.innerText = "Error loading dataset.";
            }
        })
        .catch(err => {
            console.error(err);
            datasetStats.innerText = "Upload failed.";
        });
    });

    // --- Test Datasets Modal Functions ---
    function initializeTestDatasetsModal() {
        const testDatasetsBtn = document.getElementById('test-datasets-btn');
        testDatasetsModal = document.getElementById('test-datasets-modal');
        const closeBtn = document.getElementById('close-test-datasets-btn');
        
        // Open modal
        testDatasetsBtn.addEventListener('click', () => {
            if (testDatasetsModal) {
                testDatasetsModal.style.display = 'flex';
                loadTestDatasets();
            } else {
                console.error("testDatasetsModal is undefined");
            }
        });
        
        // Close modal
        closeBtn.addEventListener('click', () => {
            if (testDatasetsModal) {
                testDatasetsModal.style.display = 'none';
            }
        });
        
        // Close modal when clicking outside
        if (testDatasetsModal) {
            testDatasetsModal.addEventListener('click', (e) => {
                if (e.target === testDatasetsModal) {
                    testDatasetsModal.style.display = 'none';
                }
            });
        }
    }
    
    function loadTestDatasets() {
        const list = document.getElementById('test-datasets-list');
        
        // Show loading state
        list.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i> Loading test datasets...
            </div>
        `;
        
        fetch('/get_predefined_datasets')
            .then(response => response.json())
            .then(data => {
                if (data.datasets && data.datasets.length > 0) {
                    list.innerHTML = '';
                    
                    data.datasets.forEach(dataset => {
                        const div = document.createElement('div');
                        div.className = 'test-dataset-item';
                        div.dataset.name = dataset.name;
                        div.dataset.rows = dataset.rows;
                        div.dataset.cols = dataset.columns;
                        div.draggable = true;
                        
                        div.innerHTML = `
                            <div class="test-dataset-header">
                                <h4 class="test-dataset-name">${dataset.display_name}</h4>
                                <span class="test-dataset-type">${dataset.type}</span>
                            </div>
                            <p class="test-dataset-description">${dataset.description}</p>
                            <div class="test-dataset-info">
                                <span><i class="fas fa-table"></i> ${dataset.rows} rows</span>
                                <span><i class="fas fa-columns"></i> ${dataset.columns} columns</span>
                            </div>
                        `;
                        
                        // Add click handler to add dataset to uploaded datasets list
                        div.addEventListener('click', () => {
                            addDatasetToLibrary(dataset.name, dataset.rows, dataset.columns);
                            if (testDatasetsModal) {
                                testDatasetsModal.style.display = 'none';
                            }
                        });
                        
                        // Add drag handlers
                        div.addEventListener('dragstart', (e) => {
                            e.dataTransfer.setData('type', 'dataset');
                            e.dataTransfer.setData('dataset_name', dataset.name);
                            e.dataTransfer.setData('text', dataset.display_name);
                        });
                        
                        list.appendChild(div);
                    });
                } else {
                    list.innerHTML = `
                        <div class="empty-message">
                            <i class="fas fa-exclamation-circle"></i> No test datasets available.
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading test datasets:', error);
                list.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i> Error loading test datasets.
                    </div>
                `;
            });
    }
    
    // --- Helper: Add Dataset to Library ---
    function addDatasetToLibrary(filename, rows, cols) {
        const list = document.getElementById('uploaded-datasets-list');
        
        // Remove empty message if present
        if(list.innerText.includes('No datasets')) {
            list.innerHTML = '';
        }
        
        // Check duplicate
        if (Array.from(list.children).some(el => el.innerText.includes(filename))) {
             return; 
        }

        const div = document.createElement('div');
        div.className = 'block-item dataset-block';
        div.draggable = true;
        div.dataset.type = 'dataset';
        div.dataset.name = filename; // Store name
        div.dataset.rows = rows;
        div.dataset.cols = cols;
        div.style.position = 'relative';
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'dataset-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove dataset';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent drag/click events
            removeDatasetFromLibrary(filename, div);
        };
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'dataset-content';
        content.innerHTML = `<i class="fas fa-table" style="margin-right:5px;"></i> ${filename} <div style="font-size:0.7em; margin-top:2px;">${rows}x${cols}</div>`;
        
        div.appendChild(deleteBtn);
        div.appendChild(content);
        
        list.appendChild(div);
    }

    // --- Helper: Remove Dataset from Library ---
    function removeDatasetFromLibrary(filename, element) {
        // Remove the element with fade effect
        element.style.opacity = '0';
        element.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            element.remove();
            
            // Check if list is empty and show empty message
            const list = document.getElementById('uploaded-datasets-list');
            if (list.children.length === 0) {
                list.innerHTML = '<div style="font-size:0.8em; color:#888; padding:5px;">No datasets uploaded yet.</div>';
            }
        }, 200);
    }


    // --- Run Pipeline ---
    const runBtn = document.getElementById('run-pipeline-btn');
    const resultPanel = document.getElementById('analysis-results'); // Or wherever results go
    
    // Ensure we have a place to show structured errors
    function showErrorModal(data) {
        // If we have a modal for results, use it. If not, alert.
        // Assuming there is a result container to inject HTML into.
        const container = document.getElementById('explanation-content');
        if (container) {
            container.innerHTML = `
                <div style="background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:15px; border-radius:4px; font-family: sans-serif;">
                    <h3 style="margin-top:0; color:#856404;"><i class="fas fa-exclamation-triangle"></i> Dataset Issue Detected</h3>
                    <p>The following columns contain missing or invalid values (NaN, null, or empty):</p>
                    <ul style="font-weight:bold; margin-bottom:15px;">
                        ${data.columns.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                    <p style="margin-bottom:10px;">Machine learning algorithms require valid numeric data.</p>
                    <hr style="border-top:1px solid #e6dbb9; margin:10px 0;">
                    <strong>Suggested Fix:</strong>
                    <p style="margin-top:5px;">Add a <strong style=\"color:#0056b3; cursor:pointer; text-decoration:underline\" onclick=\"alert('Drag the Missing Value Handler block from the Preprocessing menu to the canvas.')\">Missing Value Handler</strong> preprocessing block before running the algorithm.</p>
                </div>
            `;
            // Scroll to it
            container.scrollIntoView({behavior: "smooth"});
        } else {
            alert(`Dataset Issue Detected!\n\nColumns with missing values: ${data.columns.join(', ')}\n\nPlease add a Missing Value Handler block.`);
        }
    }

    runBtn.addEventListener('click', () => {
        // Clear previous errors
        explanationPanel.innerHTML = '<p>Running pipeline...</p>';

        const pipeline = tracePipeline();
        if (pipeline.length === 0) {
             alert("Pipeline is empty or invalid. Start with a Dataset block.");
             return;
        }
        
        console.log("Traced Pipeline:", pipeline);

        runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
        runBtn.disabled = true;

        fetch('/run_pipeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pipeline: pipeline })
        })
        .then(res => res.json())
        .then(data => {
            runBtn.innerHTML = '<i class="fas fa-play"></i> Run Pipeline';
            runBtn.disabled = false;
            
            if (data.status === 'error') {
                if (data.type === 'missing_values') {
                    showErrorModal(data);
                } else {
                    explanationPanel.innerHTML = `<div style="color:red; padding:10px; border:1px solid red; border-radius:4px;">Error: ${data.error}</div>`;
                }
                return;
            }
            
            if (data.error) {
                explanationPanel.innerHTML = `<div style="color:red; padding:10px; border:1px solid red; border-radius:4px;">Error: ${data.error}</div>`;
                return;
            }
            
            // Show Results
            displayResults(data);
            
            // Store pipeline results for each block
            if (data.educational && data.educational.transformations) {
                window.pipelineResults = window.pipelineResults || {};
                data.educational.transformations.forEach(tx => {
                    // Find the block that corresponds to this transformation
                    const block = blocks.find(b => b.element.dataset.method === tx.method);
                    if (block) {
                        window.pipelineResults[block.id] = {
                            before: tx.before,
                            after: tx.after,
                            headers: tx.headers,
                            method: tx.method,
                            description: tx.description
                        };
                    }
                });
            }
            
            // Save node output data for subsequent nodes
            if (data.processed_data && data.node_id) {
                window.nodeResults = window.nodeResults || {};
                window.nodeResults[data.node_id] = {
                    columns: data.processed_data.columns || [],
                    rows: data.processed_data.rows || 0
                };
            }
        })
        .catch(err => {
            console.error(err);
            runBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            runBtn.disabled = false;
            explanationPanel.innerHTML = `<div style="color:red;">Network or Server Error. Check console.</div>`;
        });
    });

    function tracePipeline() {
        const pipelineList = [];
        const visited = new Set();
        
        let curr = blocks.find(b => b.type === 'dataset'); // Start with dataset
        
        // Error check: multiple datasets?
        // Just pick one for now.
        
        while(curr) {
            // Push object 
            pipelineList.push({
                type: curr.type,
                method: curr.element.dataset.method || '',
                dataset_name: curr.datasetFileName || undefined, 
                config: curr.config || undefined 
            });
            
            visited.add(curr.id);
            
            // Find next block connected FROM curr
            // Note: If branching, this greedy approach only follows one path.
            // Assumption: Linear pipeline.
            const conn = connections.find(c => c.from === curr.id); // && !visited.has(c.to) if we want to avoid loops, but loops impossible with greedy forward
            
            if (conn) {
                curr = blocks.find(b => b.id === conn.to);
            } else {
                curr = null;
            }
        }
        
        return pipelineList;
    }

    function displayResults(data) {
        if (!data) return;

        // 1. Show Data in Visualization Tab if available
        if (data.processed_data) {
            renderTable(data.processed_data);
        }

        // 2. Clear Previous Viz
        const vizContainer = document.getElementById('preprocessing-visualizations');
        if (vizContainer) vizContainer.innerHTML = ''; 

        // 3. Preprocessing Transformations (Comparison Before/After)
        if (data.educational && data.educational.transformations && data.educational.transformations.length > 0) {
            
            const createTableHTML = (rows, headers) => {
                if (!rows || rows.length === 0) return '<div style="padding:10px; color:#999; text-align:center;">No preview available</div>';
                let html = '<table style="width:100%; font-size: 0.75rem; border-collapse: collapse;"><thead><tr style="background:#f9f9f9;">';
                headers.forEach(h => html += `<th style="padding:6px; border:1px solid #ddd; text-align:center; font-weight:600; color:#555;">${h}</th>`);
                html += '</tr></thead><tbody>';
                rows.forEach(row => {
                    html += '<tr>';
                    row.forEach(val => {
                        let displayVal = val;
                        // Format numbers
                        if (typeof val === 'number') displayVal = parseFloat(val.toFixed(4));
                        else if (val === null || val === undefined) displayVal = '<span style="color:#bbb;">null</span>';
                        html += `<td style="padding:6px; border:1px solid #ddd; text-align:center;">${displayVal}</td>`;
                    });
                    html += '</tr>';
                });
                html += '</tbody></table>';
                return html;
            };

            data.educational.transformations.forEach(tx => {
                const txDiv = document.createElement('div');
                txDiv.className = 'viz-block';
                txDiv.style.marginBottom = '20px';
                
                const beforeHTML = createTableHTML(tx.before, tx.headers);
                const afterHTML = createTableHTML(tx.after, tx.headers);
                
                txDiv.innerHTML = `
                    <div style="background-color: #e3f2fd; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #2196f3; font-weight:bold; color:#0d47a1;">
                        <i class="fas fa-magic" style="margin-right:8px;"></i> ${tx.method} 
                        <span style="font-weight:normal; font-size:0.9em; float:right; color:#555;">${tx.description || ''}</span>
                    </div>
                    <div style="display:flex; gap:15px; align-items:flex-start;">
                        <div style="flex:1; border:1px solid #eee; border-radius:4px; padding:0; background:white;">
                            <div style="background:#f8f9fa; padding:8px; border-bottom:1px solid #eee; text-align:center; font-weight:bold; color:#666;">Before</div>
                            <div style="padding:10px; overflow-x:auto;">${beforeHTML}</div>
                        </div>
                        <div style="flex:0 0 20px; display:flex; align-items:center; justify-content:center; color:#2196f3; font-size:1.2em;">
                            <i class="fas fa-arrow-right"></i>
                        </div>
                        <div style="flex:1; border:1px solid #eee; border-radius:4px; padding:0; background:white;">
                            <div style="background:#f8f9fa; padding:8px; border-bottom:1px solid #eee; text-align:center; font-weight:bold; color:#666;">After</div>
                            <div style="padding:10px; overflow-x:auto;">${afterHTML}</div>
                        </div>
                    </div>
                `;
                vizContainer.appendChild(txDiv);
            });
        }

        // 4. Algorithm Visualization (Graphs)
        if (data.educational && data.educational.graph_data) {
            const gData = data.educational.graph_data;
            const chartDiv = document.createElement('div');
            chartDiv.className = 'viz-block algo-chart';
            chartDiv.style.marginTop = '25px';
            chartDiv.style.marginBottom = '25px';
            chartDiv.style.padding = '15px';
            chartDiv.style.background = 'white';
            chartDiv.style.border = '1px solid #e0e0e0';
            chartDiv.style.borderRadius = '8px';
            chartDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';

            // Header
            chartDiv.innerHTML = `
                <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:#2c3e50;"><i class="fas fa-chart-area"></i> Algorithm Visualization</h3>
                    <span style="font-size:0.85em; background:#f0f2f5; padding:4px 8px; border-radius:12px; color:#555;">${gData.type.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div style="position:relative; height:350px; width:100%;">
                    <canvas id="algoChart"></canvas>
                </div>
            `;
            
            vizContainer.appendChild(chartDiv);
            
            // Render Chart using Chart.js
            setTimeout(() => {
                const ctx = document.getElementById('algoChart').getContext('2d');
                let chartConfig = {};

                if (gData.type === 'linear_regression') {
                    // Scatter Points (Test Data)
                    const scatterData = gData.x_test.map((x, i) => ({x: x, y: gData.y_test[i]}));
                    
                    // Safer Min/Max to avoid stack overflow on large arrays
                    let minX = 0, maxX = 1;
                    if (gData.x_test && gData.x_test.length > 0) {
                        minX = gData.x_test.reduce((min, val) => val < min ? val : min, gData.x_test[0]);
                        maxX = gData.x_test.reduce((max, val) => val > max ? val : max, gData.x_test[0]);
                    }
                    
                    const slope = (typeof gData.slope === 'number') ? gData.slope : 0;
                    const intercept = (typeof gData.intercept === 'number') ? gData.intercept : 0;

                    const lineData = [
                        {x: minX, y: slope * minX + intercept},
                        {x: maxX, y: slope * maxX + intercept}
                    ];

                    chartConfig = {
                        type: 'scatter',
                        data: {
                            datasets: [{
                                label: 'Actual Data (Test Set)',
                                data: scatterData,
                                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                pointRadius: 5
                            }, {
                                type: 'line',
                                label: `Regression Line (y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)})`,
                                data: lineData,
                                borderColor: 'rgba(255, 99, 132, 1)',
                                borderWidth: 2,
                                fill: false,
                                pointRadius: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { title: { display: true, text: 'Feature' } },
                                y: { title: { display: true, text: 'Target' } }
                            }
                        }
                    };
                } 
                else if (gData.type === 'logistic_regression' || gData.type === 'classification_scatter') {
                    // Split classes for color coding
                    const class0 = [];
                    const class1 = [];
                    
                    if (gData.x_test) {
                        gData.x_test.forEach((x, i) => {
                            const pt = {x: x, y: (gData.type === 'logistic_regression' ? gData.y_test[i] : (gData.y_test ? gData.y_test[i] : 0))}; 
                            // For Logistic 1D: y is 0/1. For KNN 2D: y_test[i] is feature 2? 
                            // Wait, backend logic for KNN 2D: y_test passed as 'classes'. x_test is feat1, y_test in backend logic was actually feat2.
                            
                            // Let's re-verify backend logic for KNN:
                            // "x_test": [r[0] for r in X_test], "y_test": [r[1]...], "classes": y_test
                            
                            const cls = gData.classes ? gData.classes[i] : gData.y_test[i]; // Logistic uses y_test as class
                            
                            if (cls == 0) class0.push(pt.x !== undefined ? (gData.type==='classification_scatter'?{x:pt.x, y:pt.y}: {x:pt.x, y:0}) : 0); 
                            else class1.push(pt.x !== undefined ? (gData.type==='classification_scatter'?{x:pt.x, y:pt.y}: {x:pt.x, y:1}) : 1);
                        });
                    }

                    // For Logistic Curve (Optional, if we want to draw sigmoid)
                    const datasets = [
                        {
                            label: 'Class 0',
                            data: class0,
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            pointStyle: 'circle',
                            pointRadius: 6
                        },
                        {
                            label: 'Class 1',
                            data: class1,
                            backgroundColor: 'rgba(54, 162, 235, 0.6)',
                            pointStyle: 'rectRot',
                            pointRadius: 6
                        }
                    ];
                    
                    // Add Logistic Sigmoid Curve if 1D Logistic
                    if (gData.type === 'logistic_regression') {
                        // Generate curve points
                        const curveData = [];
                        
                        let minX = 0, maxX = 1;
                        if (gData.x_test && gData.x_test.length > 0) {
                            minX = gData.x_test.reduce((min, val) => val < min ? val : min, gData.x_test[0]);
                            maxX = gData.x_test.reduce((max, val) => val > max ? val : max, gData.x_test[0]);
                        }
                        
                        const step = (maxX - minX) / 50;
                        
                        if (step > 0) {
                            for(let x = minX; x <= maxX; x += step) {
                                const w = (typeof gData.weight === 'number') ? gData.weight : 0;
                                const b = (typeof gData.bias === 'number') ? gData.bias : 0;
                                const z = w * x + b;
                                const prob = 1 / (1 + Math.exp(-z));
                                curveData.push({x: x, y: prob});
                            }
                        }
                        
                        datasets.push({
                            type: 'line',
                            label: 'Sigmoid Probability',
                            data: curveData,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false
                        });
                    }

                    chartConfig = {
                        type: 'scatter',
                        data: { datasets: datasets },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { title: { display: true, text: 'Feature 1' } },
                                y: { 
                                    title: { display: true, text: gData.type === 'logistic_regression' ? 'Probability / Class' : 'Feature 2' },
                                    min: (gData.type === 'logistic_regression') ? -0.1 : undefined,
                                    max: (gData.type === 'logistic_regression') ? 1.1 : undefined
                                }
                            }
                        }
                    };
                }

                if (window.algoChartInstance) window.algoChartInstance.destroy();
                window.algoChartInstance = new Chart(ctx, chartConfig);

            }, 100);
        }

        // Switch to Viz Tab
        if (window.switchTab) window.switchTab('visualization');

        // 3. Show Explanation in Details Tab
        let html = '';
        
        if (data.educational) {
            html += `<div class="explanation-title" style="color: #27ae60; border-color: #27ae60;">
                <i class="fas fa-check-circle"></i> Success
            </div>`;
            
            if (data.educational.algorithm) {
                // Algorithm Results
                html += `
                    <p><strong>${data.educational.algorithm}</strong></p>
                    <p>${data.educational.learning_expl || ''}</p>
                    <hr>
                    <p><strong>Equation:</strong> ${data.educational.equation}</p>
                    <p><strong>MSE:</strong> ${data.mse}</p>
                `;
            } else {
                // Preprocessing Only
                html += `<p><strong>Preprocessing Complete!</strong></p>`;
            }
            
            if (data.educational.preprocessing && data.educational.preprocessing.length > 0) {
                 html += `<div style="background:#e3f2fd; padding:10px; border-radius:5px; margin-top:10px;">
                    <strong>Steps Applied:</strong>
                    <ul style="margin:5px 0 0 20px;">
                        ${data.educational.preprocessing.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                 </div>`;
            }
            
            html += `<p style="margin-top:10px; font-style:italic;">${data.educational.explanation || ''}</p>`;
        }
        
        // Update Details Panel (even if hidden)
        explanationPanel.innerHTML = html;
        
        // If we have training results, maybe switch to details? 
        // User asked for "Visual Feedback", table is good. Details populated is also good.
        
        blocks.forEach(b => b.element.style.boxShadow = '0 0 5px #27ae60');
        setTimeout(() => blocks.forEach(b => b.element.style.boxShadow = ''), 2000);
    }
    
    function renderTable(dataRaw) {
        const tableHeader = document.getElementById('table-header');
        const tableBody = document.getElementById('table-body');
        
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';
        
        if (!dataRaw || !dataRaw.rows) return;
        
        // Header
        const trH = document.createElement('tr');
        dataRaw.columns.forEach(col => {
            const th = document.createElement('th');
            th.innerText = col;
            try{ th.style.background="#f5f5f5"; th.style.padding="8px"; }catch(e){}
            trH.appendChild(th);
        });
        tableHeader.appendChild(trH);
        
        // Rows
        // dataRaw.rows is [[], []]
        dataRaw.rows.slice(0, 500).forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(val => {
                const td = document.createElement('td');
                td.innerText = (typeof val === 'number') ? parseFloat(val.toFixed(4)) : val;
                td.style.padding = "5px";
                td.style.border = "1px solid #eee";
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    }

    // Expose renderTable? Not needed if inside closure.
    // However, fetchDatasetPreview calls it from selectBlock closure scope which is fine.
    
    // Moved Scope End to bottom of file.



// --- Dataset Viewer & Export Logic ---

let currentViewerDataset = null;
let currentDatasetRows = [];
let currentDatasetHeaders = [];

const viewerModal = document.getElementById('dataset-viewer-modal');
const closeViewerBtn = document.getElementById('close-viewer-btn');
const viewerTitle = document.getElementById('viewer-title');
const fullTable = document.getElementById('dataset-full-table');
const rangeInput = document.getElementById('range-input');
const applyRangeBtn = document.getElementById('apply-range-btn');
const exportPartBtn = document.getElementById('export-part-btn');
const rowInput = document.getElementById('row-input');
const selectRowBtn = document.getElementById('select-row-btn');
const colInput = document.getElementById('col-input');
const selectColBtn = document.getElementById('select-col-btn');

function openDatasetViewer(datasetName) {
    if (!datasetName) return;
    
    currentViewerDataset = datasetName;
    viewerTitle.textContent = 'Dataset: ' + datasetName;
    viewerModal.style.display = 'flex'; // Overlay flex
    
    // Clear Table
    fullTable.innerHTML = '<tr style=\'padding:20px\'><td>Loading...</td></tr>';
    
    // Fetch Data
    fetch('/get_dataset?name=' + datasetName)
    .then(res => res.json())
    .then(data => {
        if(data.rows) {
            currentDatasetRows = data.rows;
            currentDatasetHeaders = data.columns;
            renderExcelTable(data.columns, data.rows);
        } else {
             fullTable.innerHTML = '<tr><td>Error loading data</td></tr>';
        }
    })
    .catch(err => {
        console.error(err);
        fullTable.innerHTML = '<tr><td>Error loading data</td></tr>';
    });
}

// Convert 0 -> A, 1 -> B, 26 -> AA
function idxToCol(idx) {
    let s = '';
    while (idx >= 0) {
        s = String.fromCharCode((idx % 26) + 65) + s;
        idx = Math.floor(idx / 26) - 1;
    }
    return s;
}

// Convert A -> 0, B -> 1
function colToIdx(colStr) {
    colStr = colStr.toUpperCase();
    let idx = 0;
    for (let i = 0; i < colStr.length; i++) {
        idx = idx * 26 + (colStr.charCodeAt(i) - 64);
    }
    return idx - 1;
}

function renderExcelTable(columns, rows) {
    fullTable.innerHTML = '';
    
    const thead = document.createElement('thead');
    
    // First Header Row - Column Letters (A, B, C...)
    const trLetters = document.createElement('tr');
    trLetters.className = 'column-letters-row';
    
    // Corner Cell for letters row
    const thCornerLetter = document.createElement('th');
    thCornerLetter.innerText = '';
    thCornerLetter.className = 'corner-cell';
    trLetters.appendChild(thCornerLetter);
    
    // Column Letters
    columns.forEach((col, idx) => {
        const thLetter = document.createElement('th');
        thLetter.innerText = idxToCol(idx);
        thLetter.className = 'column-letter';
        thLetter.title = 'Column ' + idxToCol(idx);
        trLetters.appendChild(thLetter);
    });
    thead.appendChild(trLetters);
    
    // Second Header Row - Column Names
    const trNames = document.createElement('tr');
    trNames.className = 'column-names-row';
    
    // Corner Cell for names row
    const thCornerName = document.createElement('th');
    thCornerName.innerText = '';
    thCornerName.className = 'corner-cell';
    trNames.appendChild(thCornerName);
    
    // Column Names
    columns.forEach((col, idx) => {
        const thName = document.createElement('th');
        thName.innerText = col;
        thName.className = 'column-name';
        thName.title = col;
        trNames.appendChild(thName);
    });
    thead.appendChild(trNames);
    
    fullTable.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    // Limit rows for performance if massive? 
    // Requirement says 'thousands of rows with scrolling'. 
    // DOM might choke on 10k rows. rendering 1000 is safe.
    // Let's render all but be mindful. Or use virtual scrolling (complex).
    // Let's render first 2000 for now or all if small.
    const renderLimit = Math.min(rows.length, 2000); 
    
    for (let i = 0; i < renderLimit; i++) {
        const tr = document.createElement('tr');
        
        // Row Number (1-based)
        const tdIdx = document.createElement('td');
        tdIdx.innerText = (i + 1);
        tr.appendChild(tdIdx);
        
        rows[i].forEach(val => {
            const td = document.createElement('td');
            td.innerText = val !== null ? val : '';
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    }
    fullTable.appendChild(tbody);
}

// Close Modal
if (closeViewerBtn) {
    closeViewerBtn.onclick = () => {
        viewerModal.style.display = 'none';
        // Clear selection inputs
        if(rangeInput) rangeInput.value = '';
        if(rowInput) rowInput.value = '';
        if(colInput) colInput.value = '';
    };
}

// --- Selection Logic ---

function clearSelection() {
    const selected = fullTable.querySelectorAll('.selected-cell');
    selected.forEach(td => td.classList.remove('selected-cell'));
}

function highlightRange(rStart, rEnd, cStart, cEnd) {
    clearSelection();
    
    // Rows are inside tbody, so index matches (0th row in tbody is data row 0)
    // But table has thead. Use fullTable.tBodies[0].rows
    const tbody = fullTable.tBodies[0];
    if (!tbody) return;
    
    for (let r = rStart; r < rEnd; r++) {
        if (r >= tbody.rows.length) break;
        const tr = tbody.rows[r];
        
        for (let c = cStart; c < cEnd; c++) {
            // tr.cells[0] is the Row Number column. Data starts at index 1.
            // So data column c is at index c + 1
            if (c + 1 < tr.cells.length) {
                tr.cells[c + 1].classList.add('selected-cell');
            }
        }
    }
}

if (applyRangeBtn) {
    applyRangeBtn.onclick = () => {
        const range = rangeInput.value.trim().toUpperCase();
        // Parse A1:C10
        const match = range.match(/([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)/);
        if (match) {
            const startCol = colToIdx(match[1]);
            const startRow = parseInt(match[2]) - 1;
            const endCol = colToIdx(match[3]);
            const endRow = parseInt(match[4]) - 1;
            
            const rMin = Math.min(startRow, endRow);
            const rMax = Math.max(startRow, endRow) + 1;
            const cMin = Math.min(startCol, endCol);
            const cMax = Math.max(startCol, endCol) + 1;
            
            highlightRange(rMin, rMax, cMin, cMax);
        } else {
             alert('Invalid Range Format. Use A1:C10');
        }
    };
}

if (selectRowBtn) {
    selectRowBtn.onclick = () => {
        const val = rowInput.value.toLowerCase().replace('row', '').trim();
        const rIdx = parseInt(val) - 1;
        if (!isNaN(rIdx)) {
            // Highlight full row across all columns
            highlightRange(rIdx, rIdx + 1, 0, currentDatasetHeaders.length);
            // Update main range input for export context
            rangeInput.value = 'Row ' + (rIdx + 1);
        }
    };
}

if (selectColBtn) {
    selectColBtn.onclick = () => {
        const val = colInput.value.toLowerCase().replace('col', '').replace('column','').trim();
        const cIdx = colToIdx(val);
        if (cIdx > -1) {
            highlightRange(0, currentDatasetRows.length, cIdx, cIdx + 1);
            rangeInput.value = 'Col ' + val.toUpperCase();
        }
    };
}

// --- Export Logic ---

if (exportPartBtn) {
    exportPartBtn.onclick = () => {
        const range = rangeInput.value.trim();
        if (!range) {
            alert('Please select a range first.');
            return;
        }
        
        // Visual Feedback
        exportPartBtn.innerHTML = '<i class=\'fas fa-spinner fa-spin\'></i> Exporting...';
        
        fetch('/export_dataset_part', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                dataset: currentViewerDataset,
                range: range
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('Export Failed: ' + data.error);
            } else {
                alert('Dataset part exported to workspace');
                
                // Add to Workspace Canvas directly
                createDatasetBlockOnCanvas(data.new_dataset);
                
                // Close Viewer
                viewerModal.style.display = 'none';
            }
        })
        .catch(err => {
            console.error(err);
            alert('Export failed.');
        })
        .finally(() => {
            exportPartBtn.innerHTML = '<i class=\'fas fa-file-export\'></i> Export Selection';
        });
    };
}

// Removed duplicate addDatasetToLibrary




function createDatasetBlockOnCanvas(datasetName) {
    // Wrapper for createBlock to follow specific positioning or setup
    // Center of canvas: 400, 200 as requested
    createBlock('dataset', '', datasetName, 400, 200, datasetName, {isExported: true});
}


// --- Dataset Configuration Logic ---
const configModal = document.getElementById('dataset-config-modal');
const saveConfigBtn = document.getElementById('save-config-btn');
let currentConfigBlockId = null;
let currentConfigDataset = null;

// Global helper functions for configuration modal
window.toggleAllDatasetFeatures = function(state) {
    const list = document.getElementById('config-features-list');
    if (list) {
        list.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            if (!chk.disabled) chk.checked = state;
        });
    }
};

window.toggleAllDatasetColumns = function(state) {
    const list = document.getElementById('config-columns-list');
    if (list) {
        list.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.checked = state;
        });
    }
};

function openDatasetConfig(blockId, datasetName) {
    currentConfigBlockId = blockId;
    currentConfigDataset = datasetName;
    
    // Fetch columns
    fetch(`/get_dataset?name=${datasetName}`)
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert('Error fetching dataset info: ' + data.error);
            return;
        }
        
        const columns = data.columns;
        populateConfigModal(columns, blockId);
        configModal.style.display = 'block';
    })
    .catch(err => console.error(err));
}

function populateConfigModal(columns, blockId) {
    const block = blocks.find(b => b.id === blockId);
    const existingConfig = block.config || { type: 'supervised' }; // Default
    
    // Set Radio
    const radios = document.getElementsByName('learning-type');
    radios.forEach(r => {
        r.checked = (r.value === existingConfig.type);
    });
    toggleConfigMode(existingConfig.type);
    
    // Populate Target Select (Supervised)
    const targetSelect = document.getElementById('config-target-select');
    targetSelect.innerHTML = '<option value="">Select a column...</option>';
    columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.innerText = col;
        if (existingConfig.label === col) opt.selected = true;
        targetSelect.appendChild(opt);
    });
    
    // Feature List (Supervised)
    const featureList = document.getElementById('config-features-list');
    featureList.innerHTML = '';
    columns.forEach(col => {
        const div = document.createElement('div');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = col;
        chk.style.marginRight = '10px';
        
        // Logic: If new, select all except target. If existing, check config.
        if (block.config) {
             if (existingConfig.features && existingConfig.features.includes(col)) chk.checked = true;
        } else {
             // Default: Select all
             chk.checked = true;
        }
        
        // If it's the target, maybe disable or uncheck? 
        // Let's interactively update on target change.
        
        div.appendChild(chk);
        div.appendChild(document.createTextNode(col));
        featureList.appendChild(div);
    });
    
    // Column List (Unsupervised)
    const unsupList = document.getElementById('config-columns-list');
    unsupList.innerHTML = '';
    columns.forEach(col => {
        const div = document.createElement('div');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = col;
        chk.style.marginRight = '10px';
        
        if (block.config && existingConfig.type === 'unsupervised') {
             if (existingConfig.columns && existingConfig.columns.includes(col)) chk.checked = true;
        } else {
             chk.checked = true;
        }
        
        div.appendChild(chk);
        div.appendChild(document.createTextNode(col));
        unsupList.appendChild(div);
    });

    // Handle Target Selection Change to update Features checkboxes
    targetSelect.onchange = function() {
        const val = this.value;
        const checks = featureList.querySelectorAll('input[type="checkbox"]');
        checks.forEach(c => {
            if (c.value === val) {
                c.checked = false;
                c.disabled = true;
                c.parentElement.style.opacity = '0.5';
            } else {
                c.disabled = false;
                c.parentElement.style.opacity = '1';
                // c.checked = true; // Optional: auto check others
            }
        });
    };
    
    // Trigger change initially to set disabled state
    if (existingConfig.label) targetSelect.dispatchEvent(new Event('change'));
}

saveConfigBtn.addEventListener('click', () => {
    if (!currentConfigBlockId) return;
    
    const block = blocks.find(b => b.id === currentConfigBlockId);
    if (!block) return;
    
    const type = document.querySelector('input[name="learning-type"]:checked').value;
    const config = { type: type };
    
    if (type === 'supervised') {
        const label = document.getElementById('config-target-select').value;
        if (!label) {
            alert("Please select a target label.");
            return;
        }
        config.label = label;
        
        const features = [];
        document.querySelectorAll('#config-features-list input:checked').forEach(c => {
            features.push(c.value);
        });
        
        if (features.length === 0) {
            alert("Please select at least one feature.");
            return;
        }
        config.features = features;

        // Check for algorithm constraints locally just to warn user
        if (features.length > 1) {
             // We can check if any Linear/Logistic block is connected, but simple warning is enough
             // alert("Note: Make sure your connected algorithm supports multiple features.");
        }
        
    } else {
        const cols = [];
        document.querySelectorAll('#config-columns-list input:checked').forEach(c => {
             cols.push(c.value);
        });
        
        if (cols.length === 0) {
             alert("Please select columns to analyze.");
             return;
        }
        config.columns = cols;
    }
    
    // Save to block
    block.config = config;
    
    // Update Visual Indicator
    updateBlockVisuals(block);
    
    configModal.style.display = 'none';
});

function updateBlockVisuals(block) {
    // block.element is the DOM node.
    let sub = block.element.querySelector('.block-info');
    if (!sub) {
        sub = document.createElement('div');
        sub.className = 'block-info';
        sub.style.fontSize = '0.65em'; 
        sub.style.marginTop = '2px';
        sub.style.color = '#555';
        sub.style.backgroundColor = 'rgba(255,255,255,0.6)';
        sub.style.padding = '2px 4px';
        sub.style.borderRadius = '3px';
        sub.style.lineHeight = '1.2';
        sub.style.maxWidth = '100%';
        sub.style.overflow = 'hidden';
        sub.style.textOverflow = 'ellipsis';
        sub.style.whiteSpace = 'nowrap';
        block.element.appendChild(sub);
    }
    
    sub.innerHTML = '';
    
    if (!block.config) {
        sub.style.display = 'none';
        return;
    }
    
    sub.style.display = 'block';

    if (block.type === 'dataset') {
        if (block.config.type === 'supervised') {
            sub.innerHTML = `<div>Type: Supervised</div><div title="${block.config.label}">Target: ${block.config.label}</div>`;
        } else {
            sub.innerHTML = `<div>Type: Unsupervised</div><div>Cols: ${block.config.columns ? block.config.columns.length : 0}</div>`;
        }
    } else if (block.type === 'preprocess') {
        const method = block.element.dataset.method;
        if (method === 'categorical_encoder') {
            if (block.config && block.config.column) {
                const count = block.config.mapping ? Object.keys(block.config.mapping).length : 0;
                sub.innerHTML = `<div>Col: ${block.config.column}</div><div>Mappings: ${count}</div>`;
            } else {
                 sub.innerHTML = '<div>No Config</div>';
            }
        } else if (method === 'value_standardizer') {
            if (block.config && block.config.column) {
                const count = block.config.mapping ? Object.keys(block.config.mapping).length : 0;
                sub.innerHTML = `<div>Col: ${block.config.column}</div><div>Fixes: ${count}</div>`;
            } else {
                 sub.innerHTML = '<div>No Config</div>';
            }
        } else if (method === 'missing_value_handling') {
             const strat = block.config && block.config.strategy ? block.config.strategy : 'mean';
             sub.innerHTML = `<div>Strategy: ${strat.charAt(0).toUpperCase() + strat.slice(1)}</div>`;
        } else {
            const cols = block.config.columns || [];
            if (cols.length > 0) {
                 // Show first 2 columns then +X more
                 const display = cols.slice(0, 2).join(', ');
                 const extra = cols.length > 2 ? `+${cols.length-2}` : '';
                 sub.innerHTML = `<div>Cols: ${display} ${extra}</div>`;
                 sub.title = "Selected: " + cols.join(', ');
            }
        }
    }
}

// Ensure global scope access for onclick bindings
window.toggleAllPreproc = function(state) {
    const checks = document.querySelectorAll('#preprocess-columns-list input[type="checkbox"]');
    checks.forEach(c => c.checked = state);
};

/* --- Categorical Encoder Logic --- */
const catConfigModal = document.getElementById('categorical-config-modal');
const catColSelect = document.getElementById('cat-encoder-col-select');
const catMappingSection = document.getElementById('cat-mapping-section');
const catMappingList = document.getElementById('cat-mapping-list');
const saveCatConfigBtn = document.getElementById('save-cat-config-btn');
let currentCatBlockId = null;

function openCategoricalConfig(blockId) {
    currentCatBlockId = blockId;
    const block = blocks.find(b => b.id === blockId);
    
    // Get the immediate input node (previous node in the chain)
    const inputNode = getImmediateInputNode(blockId);
    if (!inputNode) {
        alert("Please connect this block to a dataset first.");
        return;
    }
    
    // Get data from the input node's output, not original dataset
    const inputData = getNodeOutputData(inputNode.id);
    if (!inputData || !inputData.columns) {
        alert("Input node has no data available. Please run the previous node first.");
        return;
    }
    
    // 1. Fetch Columns
    displayMsg("Fetching columns...", catColSelect);
    
    populateCatColSelect(inputData.columns, block, inputData.datasetName);
    catConfigModal.style.display = 'block';
}

function displayMsg(msg, selectEl) {
    selectEl.innerHTML = `<option>${msg}</option>`;
}

function populateCatColSelect(columns, block, datasetName) {
    catColSelect.innerHTML = '<option value="">Select a column...</option>';
    catMappingSection.style.display = 'none';

    columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.innerText = col;
        if (block.config && block.config.column === col) {
            opt.selected = true;
        }
        catColSelect.appendChild(opt);
    });

    // Event Listener for Column Change
    catColSelect.onchange = function() {
        const col = this.value;
        if (col) {
            fetchUniqueValues(datasetName, col, block);
        } else {
            catMappingSection.style.display = 'none';
        }
    };
    
    // Trigger if already selected
    if (block.config && block.config.column) {
        fetchUniqueValues(datasetName, block.config.column, block);
    }
}

function fetchUniqueValues(datasetName, colName, block) {
    catMappingSection.style.display = 'block';
    catMappingList.innerHTML = '<tr><td colspan="2"><i class="fas fa-spinner fa-spin"></i> Loading values...</td></tr>';
    
    fetch(`/get_column_values?dataset=${datasetName}&column=${colName}`)
    .then(res => res.json())
    .then(data => {
        if(data.error) {
            catMappingList.innerHTML = `<tr><td colspan="2" style="color:red;">Error: ${data.error}</td></tr>`;
            return;
        }
        renderMappingInputs(data.values, block);
    })
    .catch(err => {
        console.error(err);
        catMappingList.innerHTML = '<tr><td colspan="2" style="color:red;">Failed to load values</td></tr>';
    });
}

function renderMappingInputs(values, block) {
    catMappingList.innerHTML = '';
    const existingMap = block.config ? (block.config.mapping || {}) : {};
    
    // Auto-assign start index (1, 2, 3...)
    let autoIdx = 1;
    
    values.forEach(val => {
        const tr = document.createElement('tr');
        
        const tdVal = document.createElement('td');
        tdVal.innerText = val;
        
        const tdInput = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'cat-mapping-input';
        input.dataset.original = val;
        input.style.width = '100px';
        input.placeholder = autoIdx;
        
        // Use existing if available, else auto suggestion
        if (existingMap[val] !== undefined) {
             input.value = existingMap[val];
        } else {
             input.value = autoIdx; // Suggestion
        }
        
        autoIdx++;
        
        tdInput.appendChild(input);
        tr.appendChild(tdVal);
        tr.appendChild(tdInput);
        catMappingList.appendChild(tr);
    });
}

if (saveCatConfigBtn) {
    saveCatConfigBtn.addEventListener('click', () => {
        if (!currentCatBlockId) return;
        const block = blocks.find(b => b.id === currentCatBlockId);
        if (!block) return;
        
        const col = catColSelect.value;
        if (!col) {
            alert("Please select a column.");
            return;
        }
        
        const mapping = {};
        const inputs = document.querySelectorAll('.cat-mapping-input');
        let isValid = true;
        
        inputs.forEach(inp => {
            const original = inp.dataset.original;
            const numeric = inp.value;
            
            if (numeric === '') {
                 isValid = false; 
            }
            mapping[original] = numeric;
        });
        
        if (!isValid) {
            if (!confirm("Some values have no mapping defined. They will remain as strings. Continue?")) {
                return;
            }
        }
        
        block.config = {
            column: col,
            mapping: mapping
        };
        
        updateBlockVisuals(block);
        catConfigModal.style.display = 'none';
    });
}

/* --- Preprocessing Configuration Logic --- */

const preprocConfigModal = document.getElementById('preprocessing-config-modal');

const savePreprocConfigBtn = document.getElementById('save-preprocess-config-btn');
let currentPreprocBlockId = null;

// Traverse backwards to find the data source
function findConnectedDataset(blockId) {
    let visited = new Set();
    let queue = [blockId];
    
    while(queue.length > 0) {
        let currId = queue.shift();
        if (visited.has(currId)) continue;
        visited.add(currId);
        
        let b = blocks.find(bk => bk.id === currId);
        // If we found a dataset block directly
        if (b && b.type === 'dataset' && b.datasetFileName) {
            return b;
        }
        
        // Traverse UPSTREAM (where connections come FROM)
        // Connection: from -> to. We are at 'to'. We need 'from'.
        const inputConns = connections.filter(c => c.to === currId);
        inputConns.forEach(c => {
             if (!visited.has(c.from)) queue.push(c.from);
        });
    }
    return null;
}

function openPreprocessingConfig(blockId) {
    currentPreprocBlockId = blockId;
    const block = blocks.find(b => b.id === blockId);
    
    // Get the immediate input node (previous node in the chain)
    const inputNode = getImmediateInputNode(blockId);
    if (!inputNode) {
        alert("Please connect this block to a dataset first so we know columns.");
        return;
    }
    
    // Get data from the input node's output, not original dataset
    const inputData = getNodeOutputData(inputNode.id);
    if (!inputData || !inputData.columns) {
        alert("Input node has no data available. Please run the previous node first.");
        return;
    }
    
    populatePreprocModal(inputData.columns, block);
    preprocConfigModal.style.display = 'block';
}

// Get the immediate input node to this block
function getImmediateInputNode(blockId) {
    const inputConns = connections.filter(c => c.to === blockId);
    if (inputConns.length === 0) return null;
    
    const inputNodeId = inputConns[0].from;
    return blocks.find(b => b.id === inputNodeId);
}

// Get the output data from a specific node
function getNodeOutputData(nodeId) {
    // Check if we have cached results from a previous run
    const nodeResults = window.nodeResults || {};
    if (nodeResults[nodeId]) {
        return nodeResults[nodeId];
    }
    
    // If no cached results, get from original dataset
    const block = blocks.find(b => b.id === nodeId);
    if (block && block.type === 'dataset') {
        // Return original dataset info
        return {
            columns: block.datasetColumns || [],
            rows: block.datasetRows || 0
        };
    }
    
    return null;
}

function populatePreprocModal(columns, block) {
    const list = document.getElementById('preprocess-columns-list');
    list.innerHTML = '';
    
    const existingColumns = block.config ? (block.config.columns || []) : [];
    const hasConfig = block.config && block.config.columns;
    
    columns.forEach(col => {
        const div = document.createElement('div');
        div.style.marginBottom = '5px';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = col;
        chk.style.marginRight = '10px';
        chk.style.cursor = 'pointer';
        
        // Default to checked if no config exists, or if specifically included
        if (!hasConfig) {
             chk.checked = true;
        } else {
             chk.checked = existingColumns.includes(col);
        }
        
        const lbl = document.createElement('span');
        lbl.innerText = col;
        lbl.onclick = () => chk.click(); // Click text to toggle
        lbl.style.cursor = 'pointer';
        
        div.appendChild(chk);
        div.appendChild(lbl);
        list.appendChild(div);
    });
}

if (savePreprocConfigBtn) {
    savePreprocConfigBtn.addEventListener('click', () => {
        if (!currentPreprocBlockId) return;
        
        const block = blocks.find(b => b.id === currentPreprocBlockId);
        if (!block) return;
        
        const selected = [];
        document.querySelectorAll('#preprocess-columns-list input:checked').forEach(c => {
             selected.push(c.value);
        });
        
        if (selected.length === 0) {
             alert("Please select at least one column for preprocessing.");
             return; 
        }
        
        block.config = { columns: selected };
        
        // Visual Summary
        updateBlockVisuals(block);
        
        preprocConfigModal.style.display = 'none';
        
        // Notify user
        // alert("Configuration Saved");
    });
}


/* --- Missing Value Configuration Logic --- */

const missingValModal = document.getElementById('missing-value-config-modal');
const missingValColsList = document.getElementById('missing-val-cols-list');
const saveMissingValBtn = document.getElementById('save-missing-val-btn');
const customValInput = document.getElementById('strat-custom-val');
let currentMissingValBlockId = null;

// Handle Custom Input Enable/Disable
document.querySelectorAll('input[name="impute-strat"]').forEach(rb => {
    rb.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customValInput.disabled = false;
            customValInput.focus();
        } else {
            customValInput.disabled = true;
        }
    });
});

window.openMissingValueConfig = function(blockId) {
    currentMissingValBlockId = blockId;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const datasetBlock = findConnectedDataset(blockId);
    if (!datasetBlock) {
        alert("Please connect this block to a dataset first.");
        return;
    }
    
    // reset UI
    missingValColsList.innerHTML = '<div>Loading columns...</div>';
    
    // Load config state
    const currentStrat = block.config && block.config.strategy ? block.config.strategy : 'mean';
    const currentCustom = block.config && block.config.customValue ? block.config.customValue : '';
    const currentCols = block.config && block.config.columns ? block.config.columns : [];

    // Set Radio
    const rb = document.querySelector(`input[name="impute-strat"][value="${currentStrat}"]`);
    if (rb) {
        rb.checked = true;
        // Trigger change event to set disabled state
        rb.dispatchEvent(new Event('change'));
    }
    if (currentCustom && currentStrat === 'custom') customValInput.value = currentCustom;

    // Fetch Columns
    fetch(`/get_dataset?name=${datasetBlock.datasetFileName}`)
    .then(res => res.json())
    .then(data => {
         if(data.error) { alert(data.error); return; }
         populateMissingValCols(data.columns, currentCols);
         missingValModal.style.display = 'block';
    })
    .catch(err => console.error(err));
}

function populateMissingValCols(allColumns, selectedColumns) {
    missingValColsList.innerHTML = '';
    const isNewConfig = (selectedColumns.length === 0); 
    
    allColumns.forEach(col => {
        const div = document.createElement('div');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = col;
        
        // Default check all if new, else check if in list
        if (isNewConfig) {
            chk.checked = true;
        } else {
            chk.checked = selectedColumns.includes(col);
        }
        
        const span = document.createElement('span');
        span.innerText = col;
        span.style.marginLeft = '5px';
        
        div.appendChild(chk);
        div.appendChild(span);
        missingValColsList.appendChild(div);
    });
}

if (saveMissingValBtn) {
    saveMissingValBtn.addEventListener('click', () => {
        if (!currentMissingValBlockId) return;
        const block = blocks.find(b => b.id === currentMissingValBlockId);
        
        // Get Strategy
        const strat = document.querySelector('input[name="impute-strat"]:checked').value;
        const customVal = customValInput.value;
        
        // Get Columns
        const cols = [];
        missingValColsList.querySelectorAll('input:checked').forEach(chk => {
            cols.push(chk.value);
        });
        
        if (cols.length === 0) {
            alert("Please select at least one column.");
            return;
        }
        
        block.config = {
            strategy: strat,
            columns: cols,
            customValue: (strat === 'custom') ? customVal : null
        };
        
        updateBlockVisuals(block);
        missingValModal.style.display = 'none';
    });
}


const stdConfigModal = document.getElementById('standardizer-config-modal');
const stdColSelect = document.getElementById('std-col-select');
const stdMappingSection = document.getElementById('std-mapping-section');
const stdMappingList = document.getElementById('std-mapping-list');
const saveStdConfigBtn = document.getElementById('save-std-config-btn');
let currentStdBlockId = null;

function openStandardizerConfig(blockId) {
    currentStdBlockId = blockId;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    // Get the immediate input node (previous node in the chain)
    const inputNode = getImmediateInputNode(blockId);
    if (!inputNode) {
        alert("Please connect this block to a dataset first.");
        return;
    }
    
    // Get data from the input node's output, not original dataset
    const inputData = getNodeOutputData(inputNode.id);
    if (!inputData || !inputData.columns) {
        alert("Input node has no data available. Please run the previous node first.");
        return;
    }
    
    // 1. Fetch Columns
    displayMsg("Fetching columns...", stdColSelect);
    
    populateStdColSelect(inputData.columns, block, inputData.datasetName);
    stdConfigModal.style.display = 'block';
}

function populateStdColSelect(columns, block, datasetName) {
    stdColSelect.innerHTML = '<option value="">Select a column...</option>';
    stdMappingSection.style.display = 'none';

    columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.innerText = col;
        if (block.config && block.config.column === col) {
            opt.selected = true;
        }
        stdColSelect.appendChild(opt);
    });

    stdColSelect.onchange = function() {
        const col = this.value;
        if (col) {
            fetchUniqueValuesForStd(datasetName, col, block);
        } else {
            stdMappingSection.style.display = 'none';
        }
    };
    
    if (block.config && block.config.column) {
        fetchUniqueValuesForStd(datasetName, block.config.column, block);
    }
}

function fetchUniqueValuesForStd(datasetName, colName, block) {
    stdMappingSection.style.display = 'block';
    stdMappingList.innerHTML = '<tr><td colspan="3"><i class="fas fa-spinner fa-spin"></i> Loading values...</td></tr>';
    
    fetch(`/get_column_values?dataset=${datasetName}&column=${colName}`)
    .then(res => res.json())
    .then(data => {
        if(data.error) {
            stdMappingList.innerHTML = `<tr><td colspan="3" style="color:red;">Error: ${data.error}</td></tr>`;
            return;
        }
        renderStdMappingInputs(data.values, block);
    })
    .catch(err => {
        console.error(err);
        stdMappingList.innerHTML = '<tr><td colspan="3" style="color:red;">Failed to load values</td></tr>';
    });
}

function renderStdMappingInputs(values, block) {
    stdMappingList.innerHTML = '';
    const existingMap = block.config ? (block.config.mapping || {}) : {};
    
    values.forEach(val => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        
        const tdVal = document.createElement('td');
        tdVal.innerText = val;
        tdVal.style.padding = '8px';
        
        const tdInput = document.createElement('td');
        tdInput.style.padding = '8px';
        const input = document.createElement('input');
        input.type = 'text'; 
        input.className = 'std-mapping-input';
        input.dataset.original = val;
        input.style.width = '100%';
        input.style.padding = '4px';
        input.placeholder = val; 
        
        if (existingMap[val] !== undefined) {
             input.value = existingMap[val];
        }
        
        tdInput.appendChild(input);
        
        const tdAction = document.createElement('td');
        tdAction.style.padding = '8px';
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '&times;';
        clearBtn.title = "Clear mapping";
        clearBtn.style.background = 'transparent';
        clearBtn.style.border = 'none';
        clearBtn.style.cursor = 'pointer';
        clearBtn.style.color = '#999';
        clearBtn.onclick = () => { input.value = ''; };
        
        tdAction.appendChild(clearBtn);
        
        tr.appendChild(tdVal);
        tr.appendChild(tdInput);
        tr.appendChild(tdAction);
        
        stdMappingList.appendChild(tr);
    });
}

if (saveStdConfigBtn) {
    saveStdConfigBtn.addEventListener('click', () => {
        if (!currentStdBlockId) return;
        const block = blocks.find(b => b.id === currentStdBlockId);
        if (!block) return;
        
        const col = stdColSelect.value;
        if (!col) {
            alert("Please select a column.");
            return;
        }
        
        const mapping = {};
        const inputs = document.querySelectorAll('.std-mapping-input');
        let count = 0;

        inputs.forEach(inp => {
            const original = inp.dataset.original;
            const replacement = inp.value.trim();
            
            if (replacement !== '') {
                 mapping[original] = replacement;
                 if (replacement !== original) count++;
            }
        });
        
        block.config = {
            column: col,
            mapping: mapping
        };
        
        updateBlockVisuals(block);
        
        stdConfigModal.style.display = 'none';
    });
}

});


