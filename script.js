// Global variables
let map;
let timelineData = null;
let allMarkers = [];
let allPaths = [];
let filteredData = null;
let heatmapLayer = null;

// Initialize the map
function initMap() {
    map = L.map('map').setView([-22.9, -43.2], 11); // Default to Rio de Janeiro area based on the sample data
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
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
        visits: [],
        activities: [],
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

                // Process visits
                if (segment.visit && segment.visit.topCandidate && segment.visit.topCandidate.placeLocation) {
                    const coord = parseCoordinate(segment.visit.topCandidate.placeLocation.latLng);
                    if (coord && !isNaN(coord.lat) && !isNaN(coord.lng)) {
                        processed.visits.push({
                            lat: coord.lat,
                            lng: coord.lng,
                            startTime: startTime,
                            endTime: endTime,
                            semanticType: segment.visit.topCandidate.semanticType || 'UNKNOWN',
                            placeId: segment.visit.topCandidate.placeId || 'unknown',
                            probability: segment.visit.topCandidate.probability || 0
                        });
                    }
                }

                // Process activities
                if (segment.activity) {
                    const startCoord = segment.activity.start ? parseCoordinate(segment.activity.start.latLng) : null;
                    const endCoord = segment.activity.end ? parseCoordinate(segment.activity.end.latLng) : null;
                    
                    if (startCoord && endCoord && 
                        !isNaN(startCoord.lat) && !isNaN(startCoord.lng) &&
                        !isNaN(endCoord.lat) && !isNaN(endCoord.lng)) {
                        processed.activities.push({
                            start: startCoord,
                            end: endCoord,
                            startTime: startTime,
                            endTime: endTime,
                            distance: segment.activity.distanceMeters || 0,
                            activityType: segment.activity.topCandidate?.type || 'UNKNOWN_ACTIVITY_TYPE'
                        });
                    }
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

    console.log(`Processed: ${processed.timelinePaths.length} timeline points, ${processed.visits.length} visits, ${processed.activities.length} activities`);
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

    // Convert timeline paths to heatmap data format
    const heatmapData = paths.map(point => [point.lat, point.lng, 1]); // [lat, lng, intensity]

    // Get heatmap radius from control
    const radius = document.getElementById('heatmapRadius') ? 
        parseInt(document.getElementById('heatmapRadius').value) : 25;

    // Create heatmap layer
    heatmapLayer = L.heatLayer(heatmapData, {
        radius: radius,       // Radius of each "point" of the heatmap
        blur: 15,             // Amount of blur
        maxZoom: 18,          // Maximum zoom where the heatmap is visible
        max: 1.0,             // Maximum point intensity
        gradient: {           // Color gradient
            0.0: '#0066ff',   // Blue for low density
            0.3: '#00ff00',   // Green
            0.6: '#ffff00',   // Yellow
            0.8: '#ff6600',   // Orange
            1.0: '#ff0000'    // Red for high density
        }
    }).addTo(map);

    console.log(`Heatmap created with ${heatmapData.length} points, radius: ${radius}`);
}

// Add visits to map
function addVisitsToMap(visits) {
    visits.forEach(visit => {
        const marker = L.marker([visit.lat, visit.lng], {
            icon: L.divIcon({
                className: 'visit-marker',
                html: '🏠',
                iconSize: [25, 25],
                iconAnchor: [12, 12]
            })
        }).addTo(map);

        const duration = (visit.endTime - visit.startTime) / (1000 * 60 * 60); // hours
        
        marker.bindPopup(`
            <div class="popup-title">🏠 ${visit.semanticType}</div>
            <div class="popup-time">
                ${visit.startTime.toLocaleString()} - ${visit.endTime.toLocaleString()}
            </div>
            <div class="popup-details">
                Duration: ${duration.toFixed(1)} hours<br>
                Confidence: ${(visit.probability * 100).toFixed(1)}%<br>
                Place ID: ${visit.placeId}
            </div>
        `);

        allMarkers.push(marker);
    });
}

// Add activities to map
function addActivitiesToMap(activities) {
    activities.forEach(activity => {
        // Start marker
        const startMarker = L.marker([activity.start.lat, activity.start.lng], {
            icon: L.divIcon({
                className: 'activity-marker',
                html: '🚶‍♂️',
                iconSize: [25, 25],
                iconAnchor: [12, 12]
            })
        }).addTo(map);

        // End marker
        const endMarker = L.marker([activity.end.lat, activity.end.lng], {
            icon: L.divIcon({
                className: 'activity-marker',
                html: '🏁',
                iconSize: [25, 25],
                iconAnchor: [12, 12]
            })
        }).addTo(map);

        // Path between start and end
        const path = L.polyline([
            [activity.start.lat, activity.start.lng],
            [activity.end.lat, activity.end.lng]
        ], {
            color: '#45b7d1',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(map);

        const duration = (activity.endTime - activity.startTime) / (1000 * 60); // minutes
        const distance = (activity.distance / 1000).toFixed(2); // km

        const popupContent = `
            <div class="popup-title">🚶‍♂️ ${activity.activityType}</div>
            <div class="popup-time">
                ${activity.startTime.toLocaleString()} - ${activity.endTime.toLocaleString()}
            </div>
            <div class="popup-details">
                Duration: ${duration.toFixed(0)} minutes<br>
                Distance: ${distance} km
            </div>
        `;

        startMarker.bindPopup(popupContent);
        endMarker.bindPopup(popupContent);
        path.bindPopup(popupContent);

        allMarkers.push(startMarker, endMarker);
        allPaths.push(path);
    });
}

// Update map with processed data
function updateMap(data) {
    clearMapLayers();
    
    if (!data) return;

    console.log(`Updating map with ${data.timelinePaths.length} timeline points, ${data.visits.length} visits, ${data.activities.length} activities`);

    addTimelinePathsToMap(data.timelinePaths);
    addVisitsToMap(data.visits);
    addActivitiesToMap(data.activities);

    // Fit map bounds to show all data
    const allPoints = [];
    
    data.timelinePaths.forEach(point => allPoints.push([point.lat, point.lng]));
    data.visits.forEach(visit => allPoints.push([visit.lat, visit.lng]));
    data.activities.forEach(activity => {
        allPoints.push([activity.start.lat, activity.start.lng]);
        allPoints.push([activity.end.lat, activity.end.lng]);
    });

    if (allPoints.length > 0) {
        // Calculate bounds from all points
        const latitudes = allPoints.map(point => point[0]);
        const longitudes = allPoints.map(point => point[1]);
        
        const bounds = [
            [Math.min(...latitudes), Math.min(...longitudes)],
            [Math.max(...latitudes), Math.max(...longitudes)]
        ];
        
        map.fitBounds(bounds, { padding: [20, 20] });
    }
}

// Update statistics
function updateStats(data) {
    if (!data) {
        document.getElementById('totalPoints').textContent = '0';
        document.getElementById('totalVisits').textContent = '0';
        document.getElementById('totalActivities').textContent = '0';
        document.getElementById('dateRange').textContent = '-';
        return;
    }

    document.getElementById('totalPoints').textContent = data.timelinePaths.length.toLocaleString();
    document.getElementById('totalVisits').textContent = data.visits.length.toLocaleString();
    document.getElementById('totalActivities').textContent = data.activities.length.toLocaleString();
    
    if (data.dateRange.start && data.dateRange.end) {
        const startDate = data.dateRange.start.toLocaleDateString();
        const endDate = data.dateRange.end.toLocaleDateString();
        document.getElementById('dateRange').textContent = `${startDate} - ${endDate}`;
    }
}

// Update timeline details panel
function updateTimelineDetails(data) {
    const container = document.getElementById('timelineDetails');
    
    if (!data) {
        container.innerHTML = '<p class="placeholder">Upload a Timeline.json file to see location history</p>';
        return;
    }

    let html = '';
    
    // Combine and sort all events by time
    const allEvents = [];
    
    data.visits.forEach(visit => {
        allEvents.push({
            type: 'visit',
            time: visit.startTime,
            data: visit
        });
    });
    
    data.activities.forEach(activity => {
        allEvents.push({
            type: 'activity',
            time: activity.startTime,
            data: activity
        });
    });
    
    // Sort by time (most recent first)
    allEvents.sort((a, b) => b.time - a.time);
    
    // Show only the last 50 events to avoid performance issues
    const recentEvents = allEvents.slice(0, 50);
    
    if (recentEvents.length === 0) {
        html = '<p class="placeholder">No events found in the selected time range</p>';
    } else {
        recentEvents.forEach(event => {
            if (event.type === 'visit') {
                const visit = event.data;
                const duration = (visit.endTime - visit.startTime) / (1000 * 60 * 60);
                html += `
                    <div class="timeline-item visit">
                        <h4>🏠 ${visit.semanticType}</h4>
                        <div class="time">${visit.startTime.toLocaleString()} - ${visit.endTime.toLocaleString()}</div>
                        <div class="details">
                            Duration: ${duration.toFixed(1)} hours<br>
                            Confidence: ${(visit.probability * 100).toFixed(1)}%
                        </div>
                    </div>
                `;
            } else if (event.type === 'activity') {
                const activity = event.data;
                const duration = (activity.endTime - activity.startTime) / (1000 * 60);
                const distance = (activity.distance / 1000).toFixed(2);
                html += `
                    <div class="timeline-item activity">
                        <h4>🚶‍♂️ ${activity.activityType}</h4>
                        <div class="time">${activity.startTime.toLocaleString()} - ${activity.endTime.toLocaleString()}</div>
                        <div class="details">
                            Duration: ${duration.toFixed(0)} minutes<br>
                            Distance: ${distance} km
                        </div>
                    </div>
                `;
            }
        });
    }
    
    container.innerHTML = html;
}

// Filter data by date range
function filterDataByDate(data, fromDate, toDate) {
    if (!data || (!fromDate && !toDate)) return data;

    const filtered = {
        timelinePaths: [],
        visits: [],
        activities: [],
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

    // Filter visits
    filtered.visits = data.visits.filter(visit => {
        if (from && visit.startTime < from) return false;
        if (to && visit.startTime > to) return false;
        return true;
    });

    // Filter activities
    filtered.activities = data.activities.filter(activity => {
        if (from && activity.startTime < from) return false;
        if (to && activity.startTime > to) return false;
        return true;
    });

    return filtered;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initMap();

    // File upload
    document.getElementById('fileInput').addEventListener('change', function(e) {
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
                    alert('Error: The JSON file is too large or malformed. Try using a smaller date range or a different file.');
                    return;
                }
                
                console.log('JSON parsed successfully, processing timeline data...');
                timelineData = processTimelineData(data);
                filteredData = timelineData;
                
                console.log('Updating map...');
                updateMap(filteredData);
                updateStats(filteredData);
                updateTimelineDetails(filteredData);
                
                // Set default date range
                if (timelineData.dateRange.start && timelineData.dateRange.end) {
                    document.getElementById('dateFrom').value = timelineData.dateRange.start.toISOString().split('T')[0];
                    document.getElementById('dateTo').value = timelineData.dateRange.end.toISOString().split('T')[0];
                }
                
                console.log('Timeline visualization completed successfully!');
                
            } catch (error) {
                console.error('Processing error:', error);
                alert('Error processing file: ' + error.message + '\n\nThe file might be too large. Try filtering to a smaller date range first.');
            } finally {
                loading.classList.remove('show');
            }
        };
        
        reader.onerror = function() {
            loading.classList.remove('show');
            alert('Error reading file. The file might be too large for your browser to handle.');
        };
        
        reader.readAsText(file);
    });

    // Apply filter
    document.getElementById('applyFilter').addEventListener('click', function() {
        if (!timelineData) return;

        const fromDate = document.getElementById('dateFrom').value;
        const toDate = document.getElementById('dateTo').value;

        filteredData = filterDataByDate(timelineData, fromDate, toDate);
        updateMap(filteredData);
        updateStats(filteredData);
        updateTimelineDetails(filteredData);
    });

    // Clear filter
    document.getElementById('clearFilter').addEventListener('click', function() {
        if (!timelineData) return;

        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        
        filteredData = timelineData;
        updateMap(filteredData);
        updateStats(filteredData);
        updateTimelineDetails(filteredData);
    });

    // Heatmap radius control
    document.getElementById('heatmapRadius').addEventListener('input', function() {
        if (!filteredData) return;
        
        // Only update the heatmap, not visits/activities
        if (heatmapLayer) {
            map.removeLayer(heatmapLayer);
            heatmapLayer = null;
        }
        addTimelinePathsToMap(filteredData.timelinePaths);
    });
});

// Handle file drag and drop
document.addEventListener('dragover', function(e) {
    e.preventDefault();
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.json')) {
        document.getElementById('fileInput').files = files;
        document.getElementById('fileInput').dispatchEvent(new Event('change'));
    }
});
