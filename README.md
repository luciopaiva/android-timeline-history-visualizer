# 📍 Timeline History Visualizer

A modern web application to visualize Android location timeline data from Google Takeout Timeline.json files.

## Features

- 🗺️ **Interactive Map Visualization** - View your location history on an interactive map using Leaflet.js
- 📍 **Multiple Data Types** - Displays timeline paths, visits, and activities with different visual styles
- 📅 **Date Filtering** - Filter your timeline data by specific date ranges
- 📊 **Statistics Dashboard** - View statistics about your location data
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices
- 🎨 **Modern UI** - Beautiful gradient design with smooth animations

## Data Format Support

The application supports Timeline.json files from Google Takeout with the following data types:

### Coordinate Format
Coordinates are parsed from the format: `"latitude°, longitude°"` (e.g., `"-22.9189912°, -43.224765°"`)

### Supported Segments
- **Timeline Paths**: Movement tracks with timestamped coordinates
- **Visits**: Location visits with place information and semantic types (HOME, WORK, etc.)
- **Activities**: Movement activities with start/end points, distance, and activity type

## How to Use

1. **Open the Application**
   - Open `index.html` in your web browser
   - Or serve it using a local web server

2. **Upload Timeline Data**
   - Click "📁 Upload Timeline.json" or drag and drop your Timeline.json file
   - The application will process and visualize your data automatically

3. **Explore Your Data**
   - Use the interactive map to zoom and pan
   - Click on markers and paths to see detailed information
   - Use date filters to focus on specific time periods
   - View statistics and timeline details in the side panel

## Getting Your Timeline Data

1. Go to [Google Takeout](https://takeout.google.com/)
2. Select "Location History (Timeline)"
3. Choose JSON format
4. Download your data
5. Extract the Timeline.json file from the downloaded archive

## File Structure

```
timeline-history-visualizer/
├── index.html          # Main HTML file
├── styles.css          # CSS styles and responsive design
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## Technical Details

### Dependencies
- **Leaflet.js** - For interactive maps and geospatial visualization
- **OpenStreetMap** - Tile layer for map data

### Data Processing
- Parses Google Timeline JSON format
- Handles coordinate string conversion
- Filters and sorts temporal data
- Optimizes rendering for large datasets

### Map Features
- **Timeline Paths**: Red polylines showing movement tracks
- **Visits**: House icons for location visits
- **Activities**: Walking/finish flag icons for activities
- **Custom Popups**: Detailed information on click
- **Auto-fitting**: Map automatically zooms to show all data

## Browser Compatibility

Works in all modern browsers that support:
- ES6 JavaScript features
- CSS Grid and Flexbox
- HTML5 File API

## Privacy

This application runs entirely in your browser. Your timeline data is not uploaded to any server and remains on your local machine.

## Contributing

Feel free to contribute improvements:
1. Fork the repository
2. Make your changes
3. Submit a pull request

## License

This project is open source and available under the MIT License.
