// Import Mapbox and D3 as ESM modules
import mapboxgl from "https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Set Mapbox access token
mapboxgl.accessToken =
  "pk.eyJ1IjoiYW5pOTI4IiwiYSI6ImNtYXN5aHp2YjBzcW8ycW9oN241MThmYzQifQ.IWE7Y1RJ1ObvdwWJ4yO3sQ";

// Optimization arrays for performance
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

// Initialize the map
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [-71.09415, 42.36027], // Boston
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// Define a quantize scale for station flow colors
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

// Helper function to get coordinates for a station
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.Long, +station.Lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// Helper function to format time
function formatTime(minutes) {
  const date = new Date(0, 0, 0, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleString("en-US", { timeStyle: "short" });
}

// Helper function to calculate minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Efficiently filter trips by minute
function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) {
    return tripsByMinute.flat(); // No filtering, return all trips
  }

  // Normalize both min and max minutes to the valid range [0, 1439]
  let minMinute = (minute - 60 + 1440) % 1440;
  let maxMinute = (minute + 60) % 1440;

  // Handle time filtering across midnight
  if (minMinute > maxMinute) {
    let beforeMidnight = tripsByMinute.slice(minMinute);
    let afterMidnight = tripsByMinute.slice(0, maxMinute + 1);
    return beforeMidnight.concat(afterMidnight).flat();
  } else {
    return tripsByMinute.slice(minMinute, maxMinute + 1).flat();
  }
}

// Compute station traffic
function computeStationTraffic(stations, timeFilter = -1) {
  // Get filtered trips
  const filteredDepartures = filterByMinute(departuresByMinute, timeFilter);
  const filteredArrivals = filterByMinute(arrivalsByMinute, timeFilter);

  // Compute departures
  const departures = d3.rollup(
    filteredDepartures,
    (v) => v.length,
    (d) => d.start_station_id
  );

  // Compute arrivals
  const arrivals = d3.rollup(
    filteredArrivals,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Update station data with traffic statistics
  return stations.map((station) => {
    let id = station.Number;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

// Wait for the map to load before fetching and displaying data
map.on("load", async () => {
  // Add Boston bike lanes
  map.addSource("boston_route", {
    type: "geojson",
    data: "https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson",
  });

  map.addLayer({
    id: "bike-lanes-boston",
    type: "line",
    source: "boston_route",
    paint: {
      "line-color": "#32D400",
      "line-width": 3,
      "line-opacity": 0.4,
    },
  });

  // Add Cambridge bike lanes
  map.addSource("cambridge_route", {
    type: "geojson",
    data: "https://dsc106.com/labs/lab07/data/cambridge-bike-network.geojson",
  });

  map.addLayer({
    id: "bike-lanes-cambridge",
    type: "line",
    source: "cambridge_route",
    paint: {
      "line-color": "#32D400",
      "line-width": 3,
      "line-opacity": 0.4,
    },
  });

  // Load station data
  let jsonData;
  try {
    const stationsUrl =
      "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
    jsonData = await d3.json(stationsUrl);
    console.log("Loaded JSON Data:", jsonData);
  } catch (error) {
    console.error("Error loading JSON:", error);
    return;
  }

  let stations = jsonData.data.stations;
  console.log("Stations Array:", stations);

  // Load trip data
  let trips;
  try {
    const tripsUrl =
      "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
    trips = await d3.csv(tripsUrl, (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);

      // Organize trips by minute for efficient filtering
      let startedMinutes = minutesSinceMidnight(trip.started_at);
      departuresByMinute[startedMinutes].push(trip);

      let endedMinutes = minutesSinceMidnight(trip.ended_at);
      arrivalsByMinute[endedMinutes].push(trip);

      return trip;
    });
    console.log("Trips loaded:", trips.length);
  } catch (error) {
    console.error("Error loading trip data:", error);
    return;
  }

  // Calculate initial station traffic
  stations = computeStationTraffic(stations);

  // Create a square root scale for circle radius
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // Select the SVG element
  const svg = d3.select("#map").select("svg");

  // Append circles to the SVG for each station
  const circles = svg
    .selectAll("circle")
    .data(stations, (d) => d.Number)
    .enter()
    .append("circle")
    .attr("r", (d) => radiusScale(d.totalTraffic))
    .style("--departure-ratio", (d) =>
      stationFlow(d.departures / d.totalTraffic)
    )
    .each(function (d) {
      // Add tooltip
      d3.select(this)
        .append("title")
        .text(
          `${d.NAME}: ${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
        );
    });

  // Function to update circle positions when the map moves/zooms
  function updatePositions() {
    circles
      .attr("cx", (d) => getCoords(d).cx)
      .attr("cy", (d) => getCoords(d).cy);
  }

  // Initial position update
  updatePositions();

  // Reposition markers on map interactions
  map.on("move", updatePositions);
  map.on("zoom", updatePositions);
  map.on("resize", updatePositions);
  map.on("moveend", updatePositions);

  // Get slider and time display elements
  const timeSlider = document.getElementById("time-slider");
  const selectedTime = document.getElementById("selected-time");
  const anyTimeLabel = document.getElementById("any-time");

  // Function to update the display when the slider changes
  function updateTimeDisplay() {
    let timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
      selectedTime.textContent = "";
      anyTimeLabel.style.display = "block";
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = "none";
    }

    // Update visualization based on the time filter
    updateScatterPlot(timeFilter);
  }

  // Function to update the scatterplot based on time filter
  function updateScatterPlot(timeFilter) {
    // Adjust the radius scale range based on filter
    timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

    // Recompute station traffic based on the filtered trips
    const filteredStations = computeStationTraffic(stations, timeFilter);

    // Update the circles
    circles
      .data(filteredStations, (d) => d.Number)
      .join("circle")
      .attr("r", (d) => radiusScale(d.totalTraffic))
      .style("--departure-ratio", (d) =>
        stationFlow(d.departures / d.totalTraffic)
      )
      .each(function (d) {
        // Update tooltip
        d3.select(this)
          .select("title")
          .text(
            `${d.NAME}: ${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
          );
      });
  }

  // Listen for slider changes
  timeSlider.addEventListener("input", updateTimeDisplay);

  // Initialize display
  updateTimeDisplay();
});

// Debug log
console.log("Mapbox GL JS Loaded:", mapboxgl);
