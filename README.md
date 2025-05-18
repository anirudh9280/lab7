# Boston Bike Traffic Visualization

This interactive visualization shows bike traffic patterns in the Boston area using:

- Mapbox GL JS for the base map
- D3.js for data visualization
- Real-time filtering by time of day
- Color-coded traffic flow patterns (blue for departures, orange for arrivals)

## Features

- Interactive map showing Boston and Cambridge bike lanes
- BlueBike stations visualized as circles
- Circle size represents traffic volume
- Circle color represents traffic flow direction (departures vs arrivals)
- Time slider to filter data by hour of day
- Tooltips showing exact traffic numbers

## Data Sources

- Boston bike lanes: [Boston Open Data](https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson)
- Cambridge bike lanes: [DSC106 Lab Data](https://dsc106.com/labs/lab07/data/cambridge-bike-network.geojson)
- BlueBike stations: [BlueBikes Station Data](https://dsc106.com/labs/lab07/data/bluebikes-stations.json)
- Bike traffic: [BlueBikes Trip Data](https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv)

## How to Run

Simply open the `index.html` file in a web browser or host it on a web server.

## Implementation Notes

- Uses D3's quantize scale for color mapping
- Employs performance optimizations for smooth time filtering
- SVG overlay on Mapbox for custom visualization
