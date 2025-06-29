// Global variables
let map;
let timelineData = null;
let allMarkers = [];
let allPaths = [];
let filteredData = null;

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
    // Handle both formats: "lat°, lng°" and "lat, lng"
    const cleanCoord = coordString.replace(/°/g, '');
    const parts = cleanCoord.split(',').map(part => parseFloat(part.trim()));
    
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
    }
    return null;
}

// Process timeline data
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

    data.semanticSegments.forEach(segment => {
        const startTime = new Date(segment.startTime);
        const endTime = new Date(segment.endTime);

        // Update date range
        if (!processed.dateRange.start || startTime < processed.dateRange.start) {
            processed.dateRange.start = startTime;
        }
        if (!processed.dateRange.end || endTime > processed.dateRange.end) {
            processed.dateRange.end = endTime;
        }

        // Process timeline paths
        if (segment.timelinePath) {
            segment.timelinePath.forEach(point => {
                const coord = parseCoordinate(point.point);
                if (coord) {
                    processed.timelinePaths.push({
                        ...coord,
                        time: new Date(point.time),
                        originalTime: point.time
                    });
                }
            });
        }

        // Process visits
        if (segment.visit && segment.visit.topCandidate && segment.visit.topCandidate.placeLocation) {
            const coord = parseCoordinate(segment.visit.topCandidate.placeLocation.latLng);
            if (coord) {
                processed.visits.push({
                    ...coord,
                    startTime: startTime,
                    endTime: endTime,
                    semanticType: segment.visit.topCandidate.semanticType || 'UNKNOWN',
                    placeId: segment.visit.topCandidate.placeId,
                    probability: segment.visit.topCandidate.probability || 0
                });
            }
        }

        // Process activities
        if (segment.activity) {
            const startCoord = segment.activity.start ? parseCoordinate(segment.activity.start.latLng) : null;
            const endCoord = segment.activity.end ? parseCoordinate(segment.activity.end.latLng) : null;
            
            if (startCoord && endCoord) {
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
    });

    return processed;
}

// Clear all map layers
function clearMapLayers() {
    allMarkers.forEach(marker => map.removeLayer(marker));
    allPaths.forEach(path => map.removeLayer(path));
    allMarkers = [];
    allPaths = [];
}

// Add timeline paths to map
function addTimelinePathsToMap(paths) {
    if (paths.length === 0) return;

    // Create polyline from all points
    const latLngs = paths.map(point => [point.lat, point.lng]);
    
    const polyline = L.polyline(latLngs, {
        color: '#ff6b6b',
        weight: 3,
        opacity: 0.7
    }).addTo(map);
    
    allPaths.push(polyline);

    // Add markers for individual points (show only every 10th point to avoid clutter)
    paths.forEach((point, index) => {
        if (index % 10 === 0 || index === paths.length - 1) {
            const marker = L.circleMarker([point.lat, point.lng], {
                radius: 4,
                fillColor: '#ff6b6b',
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            marker.bindPopup(`
                <div class="popup-title">📍 Timeline Point</div>
                <div class="popup-time">${point.time.toLocaleString()}</div>
                <div class="popup-details">
                    Coordinates: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
                </div>
            `);

            allMarkers.push(marker);
        }
    });
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
        const group = new L.featureGroup(allMarkers.concat(allPaths));
        map.fitBounds(group.getBounds().pad(0.1));
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

        const loading = document.getElementById('loading');
        loading.classList.add('show');

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                timelineData = processTimelineData(data);
                filteredData = timelineData;
                
                updateMap(filteredData);
                updateStats(filteredData);
                updateTimelineDetails(filteredData);
                
                // Set default date range
                if (timelineData.dateRange.start && timelineData.dateRange.end) {
                    document.getElementById('dateFrom').value = timelineData.dateRange.start.toISOString().split('T')[0];
                    document.getElementById('dateTo').value = timelineData.dateRange.end.toISOString().split('T')[0];
                }
                
            } catch (error) {
                alert('Error parsing JSON file: ' + error.message);
                console.error('JSON parsing error:', error);
            } finally {
                loading.classList.remove('show');
            }
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
