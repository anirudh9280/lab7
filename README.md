# Boston Bike Traffic Explorer

An interactive visualization of BlueBike station activity across Boston and Cambridge, showing traffic patterns at different times of the day.

![Boston Bike Map Visualization Preview](https://raw.githubusercontent.com/suchitbhayani/bikewatching/main/assets/preview.png)

## Overview

This project visualizes bike traffic data from the Boston area's BlueBikes bike-sharing system. It shows:

- Boston and Cambridge bike lanes (shown in green)
- BlueBike stations as interactive circles:
  - Size indicates total traffic volume
  - Color represents traffic direction (blue for departures, orange for arrivals)
- Time-based filtering to view bike traffic patterns throughout the day

## Implementation Details

This project is built using:

- **Mapbox GL JS** - For the base map and bike lane visualization
- **D3.js** - For data visualization and interaction
- **Custom CSS** - For styling and responsiveness

### Key Visualization Techniques

1. **Traffic Volume** - Visualized using a square root scale for circle size to ensure accurate area representation
2. **Traffic Flow** - Represented with a color gradient (blue → orange) to show departure/arrival balance
3. **Time Filtering** - Implemented with efficient data structure to enable smooth interaction

### Performance Optimizations

The visualization uses several performance optimizations:

- Pre-organized trips by time (minute of day) for efficient filtering
- SVG overlay technique for combining Mapbox GL JS with D3.js
- Event-based circle position updates for responsive map interaction

## Data Sources

- **Boston Bike Lanes**: [Boston Open Data](https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson)
- **Cambridge Bike Lanes**: [Cambridge GIS Data](https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson)
- **BlueBikes Station Data**: [BlueBikes API](https://gbfs.bluebikes.com/gbfs/en/station_information.json)
- **BlueBikes Trip Data**: [BlueBikes System Data](https://bluebikes.com/system-data)

## Usage

1. Use the time slider to filter traffic by time of day
2. Hover over stations to see detailed traffic information
3. Pan and zoom the map to explore different areas
4. Observe how traffic patterns change throughout the day

## Setup Instructions

1. Clone this repository
2. Open `index.html` in a web browser
3. No build process or dependencies to install - all libraries are loaded via CDN

## License

This project is created for educational purposes as part of DSC106 at UCSD.
