# Timeline History Visualizer

A web app for visualizing Android location timeline data as an interactive heatmap.

This is a spiritual successor of [this other project](https://locationhistoryvisualizer.com/heatmap/), which is no longer working after Google changed the way the history is exported.

## How to export your timeline data

On your Android phone, go to ​Settings > Location > Location Services > Timeline > Export Timeline data ([source](https://support.google.com/maps/thread/266757640/unable-to-export-google-maps-timeline-takeout?hl=en)).

In the past, timeline data used to be exported via Google Takeout, but now exporting that way just generates a file that says "You have encrypted Timeline backups stored on Google servers".

## How to use it

1. **Open** XXX in your browser
2. **Upload** your Android `Timeline.json` file using the upload button
3. **Filter** by date range using the controls panel

## Running your own server

1. **Clone or download** this repository
2. **Start a local server**:
   ```bash
   python3 -m http.server 8000
   ```
3. **Open** `http://localhost:8000` in your browser
