// Global variables
let map;
let timelineData = null;
let allMarkers = [];
let allPaths = [];
let filteredData = null;
let heatmapLayer = null;
let pane = null;
let currentTileLayer = null;

// Tweakpane parameters
const PARAMS = {
    dateFrom: '',
    dateTo: '',
    tileLayer: 'OpenStreetMap',
    // Heatmap settings
    heatmapRadius: 10,
    heatmapBlur: 5,
    heatmapMinOpacity: 0.15,
    heatmapMaxZoom: 18,
    heatmapGradient: 'default',
    uploadFile: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = handleFileUpload;
        input.click();
    }
};

// Tile layer options
const TILE_LAYERS = {
    'OpenStreetMap': {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors'
    },
    'OpenStreetMap Dark': {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors © CARTO'
    },
    'OpenStreetMap Light': {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors © CARTO'
    },
    'Satellite': {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '© Esri © OpenStreetMap contributors'
    },
    'Terrain': {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors'
    }
};

// Heatmap gradient options
const HEATMAP_GRADIENTS = {
    'default': {
        0.0: 'blue',
        0.5: 'lime', 
        1.0: 'red'
    },
    'fire': {
        0.0: '#000080',
        0.25: '#0000FF',
        0.5: '#00FF00',
        0.75: '#FFFF00',
        1.0: '#FF0000'
    },
    'cool': {
        0.0: '#00FFFF',
        0.5: '#0080FF',
        1.0: '#8000FF'
    },
    'rainbow': {
        0.0: '#9400D3',
        0.17: '#4B0082',
        0.33: '#0000FF',
        0.5: '#00FF00',
        0.67: '#FFFF00',
        0.83: '#FF7F00',
        1.0: '#FF0000'
    },
    'grayscale': {
        0.0: '#000000',
        1.0: '#FFFFFF'
    }
};

// Save heatmap settings to localStorage
function saveHeatmapSettings() {
    const heatmapSettings = {
        heatmapRadius: PARAMS.heatmapRadius,
        heatmapBlur: PARAMS.heatmapBlur,
        heatmapMinOpacity: PARAMS.heatmapMinOpacity,
        heatmapMaxZoom: PARAMS.heatmapMaxZoom,
        heatmapGradient: PARAMS.heatmapGradient
    };
    
    try {
        localStorage.setItem('timelineVisualizerHeatmapSettings', JSON.stringify(heatmapSettings));
        console.log('Heatmap settings saved to localStorage');
    } catch (error) {
        console.warn('Failed to save heatmap settings to localStorage:', error);
    }
}

// Load heatmap settings from localStorage
function loadHeatmapSettings() {
    try {
        const savedSettings = localStorage.getItem('timelineVisualizerHeatmapSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            // Apply saved settings to PARAMS
            PARAMS.heatmapRadius = settings.heatmapRadius || PARAMS.heatmapRadius;
            PARAMS.heatmapBlur = settings.heatmapBlur || PARAMS.heatmapBlur;
            PARAMS.heatmapMinOpacity = settings.heatmapMinOpacity || PARAMS.heatmapMinOpacity;
            PARAMS.heatmapMaxZoom = settings.heatmapMaxZoom || PARAMS.heatmapMaxZoom;
            PARAMS.heatmapGradient = settings.heatmapGradient || PARAMS.heatmapGradient;
            
            console.log('Heatmap settings loaded from localStorage:', settings);
            return true;
        }
    } catch (error) {
        console.warn('Failed to load heatmap settings from localStorage:', error);
    }
    return false;
}

// Save tile layer preference to localStorage
function saveTileLayerPreference() {
    try {
        localStorage.setItem('timelineVisualizerTileLayer', PARAMS.tileLayer);
        console.log('Tile layer preference saved to localStorage:', PARAMS.tileLayer);
    } catch (error) {
        console.warn('Failed to save tile layer preference to localStorage:', error);
    }
}

// Load tile layer preference from localStorage
function loadTileLayerPreference() {
    try {
        const savedTileLayer = localStorage.getItem('timelineVisualizerTileLayer');
        if (savedTileLayer && TILE_LAYERS[savedTileLayer]) {
            PARAMS.tileLayer = savedTileLayer;
            console.log('Tile layer preference loaded from localStorage:', savedTileLayer);
            return true;
        }
    } catch (error) {
        console.warn('Failed to load tile layer preference from localStorage:', error);
    }
    return false;
}

// Initialize the map
function initMap() {
    // Load saved tile layer preference
    loadTileLayerPreference();
    
    map = L.map('map').setView([0, 0], 2); // Start with world view
    
    // Initialize with preferred tile layer
    currentTileLayer = L.tileLayer(TILE_LAYERS[PARAMS.tileLayer].url, {
        attribution: TILE_LAYERS[PARAMS.tileLayer].attribution + ' | <a href="https://luciopaiva.com">luciopaiva.com</a> | This app is <a href="https://github.com/luciopaiva/android-timeline-history-visualizer" target="_blank">open source</a>',
        maxZoom: 18
    }).addTo(map);
}

// Change tile layer
function changeTileLayer(layerName) {
    if (!map || !TILE_LAYERS[layerName]) {
        console.error('Invalid tile layer:', layerName);
        return;
    }
    
    // Remove current tile layer
    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }
    
    // Add new tile layer
    currentTileLayer = L.tileLayer(TILE_LAYERS[layerName].url, {
        attribution: TILE_LAYERS[layerName].attribution + ' | <a href="https://luciopaiva.com">luciopaiva.com</a> | This app is <a href="https://github.com/luciopaiva/android-timeline-history-visualizer" target="_blank">open source</a>',
        maxZoom: 18
    }).addTo(map);
    
    console.log('Tile layer changed to:', layerName);
}

// Parse coordinate string to lat/lng object
function parseCoordinate(coordString) {
    try {
        if (!coordString || typeof coordString !== 'string') {
            return null;
        }
        
        // Handle both formats: "lat°, lng°" and "lat, lng"
        const cleanCoord = coordString.replace(/°/g, '').trim();
        const parts = cleanCoord.split(',');
        
        if (parts.length !== 2) {
            return null;
        }
        
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        
        // Validate coordinates are within valid ranges
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return null;
        }
        
        return { lat: lat, lng: lng };
    } catch (error) {
        console.warn('Error parsing coordinate:', coordString, error);
        return null;
    }
}

// Process timeline data with streaming for large files
function processTimelineData(data) {
    const processed = {
        timelinePaths: [],
        dateRange: { start: null, end: null }
    };

    if (!data.semanticSegments) {
        console.error('Invalid timeline data format');
        return processed;
    }

    console.log(`Processing ${data.semanticSegments.length} segments...`);
    
    // Process segments in smaller batches to avoid stack overflow
    const segments = data.semanticSegments;
    const batchSize = 100; // Process 100 segments at a time
    
    for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);
        
        batch.forEach(segment => {
            try {
                const startTime = new Date(segment.startTime);
                const endTime = new Date(segment.endTime);

                // Update date range
                if (!processed.dateRange.start || startTime < processed.dateRange.start) {
                    processed.dateRange.start = startTime;
                }
                if (!processed.dateRange.end || endTime > processed.dateRange.end) {
                    processed.dateRange.end = endTime;
                }

                // Process timeline paths with aggressive sampling for large datasets
                if (segment.timelinePath && Array.isArray(segment.timelinePath)) {
                    // Sample more aggressively for very large paths
                    const sampleRate = segment.timelinePath.length > 1000 ? 50 : 10;
                    
                    segment.timelinePath.forEach((point, index) => {
                        if (index % sampleRate === 0 || index === segment.timelinePath.length - 1) {
                            const coord = parseCoordinate(point.point);
                            if (coord && !isNaN(coord.lat) && !isNaN(coord.lng)) {
                                processed.timelinePaths.push({
                                    lat: coord.lat,
                                    lng: coord.lng,
                                    time: new Date(point.time),
                                    originalTime: point.time
                                });
                            }
                        }
                    });
                }
            } catch (segmentError) {
                console.warn('Error processing segment:', segmentError);
                // Continue with next segment
            }
        });
        
        // Update progress
        if (i % 1000 === 0) {
            const progress = Math.round((i / segments.length) * 100);
            console.log(`Processing progress: ${progress}%`);
        }
    }

    // Limit timeline points if still too many (cap at 50,000 for heatmap performance)
    if (processed.timelinePaths.length > 50000) {
        console.log(`Reducing ${processed.timelinePaths.length} timeline points to 50,000`);
        const step = Math.ceil(processed.timelinePaths.length / 50000);
        processed.timelinePaths = processed.timelinePaths.filter((_, index) => index % step === 0);
    }

    console.log(`Processed: ${processed.timelinePaths.length} timeline points`);
    return processed;
}

// Clear all map layers
function clearMapLayers() {
    allMarkers.forEach(marker => map.removeLayer(marker));
    allPaths.forEach(path => map.removeLayer(path));
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }
    allMarkers = [];
    allPaths = [];
}

// Add timeline paths as heatmap to map
function addTimelinePathsToMap(paths) {
    if (paths.length === 0) return;

    console.log(`Creating heatmap from ${paths.length} timeline points`);

    // Ensure map container has dimensions before creating heatmap
    const mapContainer = map.getContainer();
    if (!mapContainer.offsetWidth || !mapContainer.offsetHeight) {
        console.warn('Map container has no dimensions, retrying...');
        setTimeout(() => {
            addTimelinePathsToMap(paths);
        }, 100);
        return;
    }

    // Convert timeline paths to heatmap data format
    const heatmapData = paths.map(point => [point.lat, point.lng, 1]); // [lat, lng, intensity]

    // Create heatmap layer with configurable settings
    const heatmapOptions = {
        radius: PARAMS.heatmapRadius,
        blur: PARAMS.heatmapBlur,
        minOpacity: PARAMS.heatmapMinOpacity,
        maxZoom: PARAMS.heatmapMaxZoom,
    };

    // Add gradient if not default
    if (PARAMS.heatmapGradient !== 'default') {
        heatmapOptions.gradient = HEATMAP_GRADIENTS[PARAMS.heatmapGradient];
    }

    heatmapLayer = L.heatLayer(heatmapData, heatmapOptions).addTo(map);

    console.log(`Heatmap created with ${heatmapData.length} points`);
}

// Update heatmap settings
function updateHeatmapSettings() {
    // Save settings to localStorage
    saveHeatmapSettings();
    
    if (heatmapLayer && filteredData && filteredData.timelinePaths.length > 0) {
        // Remove current heatmap
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
        
        // Recreate heatmap with new settings
        addTimelinePathsToMap(filteredData.timelinePaths);
    }
}

// Update map with processed data
function updateMap(data) {
    clearMapLayers();
    
    if (!data) return;

    console.log(`Updating map with ${data.timelinePaths.length} timeline points`);

    // Ensure map is properly sized
    setTimeout(() => {
        map.invalidateSize();
    }, 100);

    addTimelinePathsToMap(data.timelinePaths);

    // Fit map bounds to show all data
    const allPoints = [];
    
    data.timelinePaths.forEach(point => allPoints.push([point.lat, point.lng]));

    if (allPoints.length > 0) {
        // Calculate bounds from all points
        const latitudes = allPoints.map(point => point[0]);
        const longitudes = allPoints.map(point => point[1]);
        
        const bounds = [
            [Math.min(...latitudes), Math.min(...longitudes)],
            [Math.max(...latitudes), Math.max(...longitudes)]
        ];
        
        setTimeout(() => {
            map.fitBounds(bounds, { padding: [20, 20] });
        }, 200);
    }
}

// Filter data by date range
function filterDataByDate(data, fromDate, toDate) {
    if (!data || (!fromDate && !toDate)) return data;

    const filtered = {
        timelinePaths: [],
        dateRange: data.dateRange
    };

    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    
    // Adjust 'to' date to end of day
    if (to) {
        to.setHours(23, 59, 59, 999);
    }

    // Filter timeline paths
    filtered.timelinePaths = data.timelinePaths.filter(point => {
        if (from && point.time < from) return false;
        if (to && point.time > to) return false;
        return true;
    });

    return filtered;
}

// Handle file upload
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    console.log(`Loading file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    const loading = document.getElementById('loading');
    loading.classList.add('show');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            console.log('Parsing JSON...');
            
            // For very large files, we need to be more careful with parsing
            let data;
            try {
                data = JSON.parse(e.target.result);
            } catch (parseError) {
                console.error('JSON parsing failed:', parseError);
                alert('Error: The JSON file is malformed. Please check the file format.');
                return;
            }
            
            console.log('JSON parsed successfully, processing timeline data...');
            timelineData = processTimelineData(data);
            filteredData = timelineData;
            
            // Set default date range in Tweakpane
            if (timelineData.dateRange.start && timelineData.dateRange.end) {
                PARAMS.dateFrom = timelineData.dateRange.start.toISOString().split('T')[0];
                PARAMS.dateTo = timelineData.dateRange.end.toISOString().split('T')[0];
                if (pane) {
                    pane.refresh();
                }
            }
            
            console.log('Timeline visualization completed successfully!');
            
        } catch (error) {
            console.error('Processing error:', error);
            alert('Error processing file: ' + error.message);
        } finally {
            loading.classList.remove('show');
        }
    };
    
    reader.onerror = function() {
        loading.classList.remove('show');
        alert('Error reading file. The file might be too large for your browser to handle.');
    };
    
    reader.readAsText(file);
}

// Load demo data
function loadDemoData() {
    console.log('Loading demo data...');
    
    const loading = document.getElementById('loading');
    loading.classList.add('show');
    
    // Fetch the sample timeline data
    fetch('./sample-timeline.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Demo data loaded successfully');
            hideUploadDialog();
            
            timelineData = processTimelineData(data);
            filteredData = timelineData;
            
            // Set default date range in Tweakpane
            if (timelineData.dateRange.start && timelineData.dateRange.end) {
                PARAMS.dateFrom = timelineData.dateRange.start.toISOString().split('T')[0];
                PARAMS.dateTo = timelineData.dateRange.end.toISOString().split('T')[0];
                if (pane) {
                    pane.refresh();
                }
            }
            
            updateMap(filteredData);
            console.log('Demo visualization completed successfully!');
        })
        .catch(error => {
            console.error('Error loading demo data:', error);
            alert('Error loading demo data. Please try uploading your own file.');
        })
        .finally(() => {
            loading.classList.remove('show');
        });
}

// Apply date filter automatically
function applyDateFilter() {
    if (!timelineData) return;

    const fromDate = PARAMS.dateFrom;
    const toDate = PARAMS.dateTo;

    filteredData = filterDataByDate(timelineData, fromDate, toDate);
    updateMap(filteredData);
}

// Hide upload dialog
function hideUploadDialog() {
    const dialog = document.getElementById('upload-dialog');
    dialog.classList.add('hidden');
}

// Show upload dialog
function showUploadDialog() {
    const dialog = document.getElementById('upload-dialog');
    dialog.classList.remove('hidden');
}

// Handle file upload from dialog or tweakpane
function handleFileUploadFromDialog(file) {
    if (!file) return;
    
    hideUploadDialog();
    handleFileUpload({ target: { files: [file] } });
}

// Initialize Tweakpane
function initTweakpane() {
    // Check if Tweakpane is loaded
    if (typeof Tweakpane === 'undefined') {
        console.error('Tweakpane is not loaded');
        return;
    }

    const container = document.getElementById('tweakpane-container');
    if (!container) {
        console.error('Tweakpane container not found');
        return;
    }

    // Load saved settings before creating the pane
    loadHeatmapSettings();
    loadTileLayerPreference();

    pane = new Tweakpane.Pane({
        container: container,
        title: 'Timeline Controls',
        expanded: true
    });

    // Upload button
    pane.addButton({
        title: '📁 Upload Timeline.json',
    }).on('click', PARAMS.uploadFile);

    // Demo button
    pane.addButton({
        title: '🌍 Try Demo Data',
    }).on('click', loadDemoData);

    // Map style selector
    const mapFolder = pane.addFolder({
        title: 'Map Style',
        expanded: true
    });

    mapFolder.addInput(PARAMS, 'tileLayer', {
        label: 'Style',
        options: Object.keys(TILE_LAYERS).reduce((acc, key) => {
            acc[key] = key;
            return acc;
        }, {})
    }).on('change', (ev) => {
        changeTileLayer(ev.value);
        saveTileLayerPreference();
    });

    // Date filters
    const dateFolder = pane.addFolder({
        title: 'Date Filter',
        expanded: true
    });

    dateFolder.addInput(PARAMS, 'dateFrom', {
        label: 'From'
    }).on('change', applyDateFilter);

    dateFolder.addInput(PARAMS, 'dateTo', {
        label: 'To'
    }).on('change', applyDateFilter);

    // Heatmap settings
    const heatmapFolder = pane.addFolder({
        title: 'Heatmap Settings',
        expanded: true
    });

    heatmapFolder.addInput(PARAMS, 'heatmapRadius', {
        label: 'Radius',
        min: 1,
        max: 50,
        step: 1
    }).on('change', updateHeatmapSettings);

    heatmapFolder.addInput(PARAMS, 'heatmapBlur', {
        label: 'Blur',
        min: 0,
        max: 30,
        step: 1
    }).on('change', updateHeatmapSettings);

    heatmapFolder.addInput(PARAMS, 'heatmapMinOpacity', {
        label: 'Min Opacity',
        min: 0,
        max: 1,
        step: 0.01
    }).on('change', updateHeatmapSettings);

    heatmapFolder.addInput(PARAMS, 'heatmapMaxZoom', {
        label: 'Max Zoom',
        min: 1,
        max: 22,
        step: 1
    }).on('change', updateHeatmapSettings);

    heatmapFolder.addInput(PARAMS, 'heatmapGradient', {
        label: 'Gradient',
        options: Object.keys(HEATMAP_GRADIENTS).reduce((acc, key) => {
            acc[key.charAt(0).toUpperCase() + key.slice(1)] = key;
            return acc;
        }, {})
    }).on('change', updateHeatmapSettings);

    // Reset button for heatmap settings
    heatmapFolder.addButton({
        title: '🔄 Reset to Defaults',
    }).on('click', () => {
        // Reset to default values
        PARAMS.heatmapRadius = 10;
        PARAMS.heatmapBlur = 5;
        PARAMS.heatmapMinOpacity = 0.15;
        PARAMS.heatmapMaxZoom = 18;
        PARAMS.heatmapGradient = 'default';
        
        // Refresh the pane to show updated values
        pane.refresh();
        
        // Update the heatmap and save settings
        updateHeatmapSettings();
        
        console.log('Heatmap settings reset to defaults');
    });

    console.log('Tweakpane initialized successfully');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Check if Tweakpane is available
    console.log('Tweakpane available:', typeof Tweakpane !== 'undefined');
    
    // Initialize map with a small delay to ensure container is properly sized
    setTimeout(() => {
        console.log('Initializing map...');
        initMap();
        
        console.log('Initializing Tweakpane...');
        initTweakpane();
    }, 100);
    
    // Upload dialog handlers
    const uploadDialogBtn = document.getElementById('upload-dialog-btn');
    const uploadDialogInput = document.getElementById('upload-dialog-input');
    const uploadDialogDrop = document.querySelector('.upload-dialog-drop');
    const demoBtn = document.getElementById('demo-btn');
    
    uploadDialogBtn.addEventListener('click', () => {
        uploadDialogInput.click();
    });
    
    demoBtn.addEventListener('click', () => {
        loadDemoData();
    });
    
    uploadDialogInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUploadFromDialog(file);
        }
    });
    
    // Drag and drop for dialog
    uploadDialogDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDialogDrop.classList.add('drag-over');
    });
    
    uploadDialogDrop.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadDialogDrop.classList.remove('drag-over');
    });
    
    uploadDialogDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDialogDrop.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.json')) {
            handleFileUploadFromDialog(files[0]);
        }
    });
});

// Handle file drag and drop globally
document.addEventListener('dragover', function(e) {
    e.preventDefault();
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.json')) {
        // If dialog is open, use dialog handler, otherwise use tweakpane handler
        const dialog = document.getElementById('upload-dialog');
        if (!dialog.classList.contains('hidden')) {
            handleFileUploadFromDialog(files[0]);
        } else {
            handleFileUpload({ target: { files: files } });
        }
    }
});
