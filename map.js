// Import D3 and Mapbox GL as ESM modules
import mapboxgl from "https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Your Mapbox access token from the lab instructions
mapboxgl.accessToken =
  "pk.eyJ1IjoiYW5pOTI4IiwiYSI6ImNtYXN5aHp2YjBzcW8ycW9oN241MThmYzQifQ.IWE7Y1RJ1ObvdwWJ4yO3sQ";

// Create arrays for optimization
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

// Initialize the map centered on Boston
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11", // Using a light style instead of streets
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 6,
  maxZoom: 17,
});

// Helper function to calculate minutes since midnight for filtering by time
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Helper function to format time for display
function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const date = new Date();
  date.setHours(hour, minute, 0);
  return date.toLocaleString("en-US", { timeStyle: "short" });
}

// Function to efficiently filter trips by time window
function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) {
    return tripsByMinute.flat(); // No filtering
  }

  // Calculate window (60 minutes before and after the selected time)
  const minMinute = (minute - 60 + 1440) % 1440;
  const maxMinute = (minute + 60) % 1440;

  // Handle cases where the window crosses midnight
  if (minMinute > maxMinute) {
    const beforeMidnight = tripsByMinute.slice(minMinute);
    const afterMidnight = tripsByMinute.slice(0, maxMinute + 1);
    return [...beforeMidnight, ...afterMidnight].flat();
  } else {
    return tripsByMinute.slice(minMinute, maxMinute + 1).flat();
  }
}

// Original trip filtering function as fallback
function filterTripsbyTime(trips, timeFilter) {
  if (timeFilter === -1) return trips;

  return trips.filter((trip) => {
    const startMinutes = minutesSinceMidnight(trip.started_at);
    const endMinutes = minutesSinceMidnight(trip.ended_at);

    return (
      Math.abs(startMinutes - timeFilter) <= 60 ||
      Math.abs(endMinutes - timeFilter) <= 60
    );
  });
}

// Function to calculate traffic statistics for stations
function computeStationTraffic(
  stations,
  trips,
  useOptimized = false,
  timeFilter = -1
) {
  let filteredDepartures, filteredArrivals;

  if (useOptimized) {
    // Use the optimized filtering approach
    filteredDepartures = filterByMinute(departuresByMinute, timeFilter);
    filteredArrivals = filterByMinute(arrivalsByMinute, timeFilter);
  } else {
    // Use the original approach
    filteredDepartures = filterTripsbyTime(trips, timeFilter);
    filteredArrivals = filteredDepartures; // They're the same trips, just counting differently
  }

  // Calculate departures by station
  const departures = d3.rollup(
    filteredDepartures,
    (v) => v.length,
    (d) => d.start_station_id
  );

  // Calculate arrivals by station
  const arrivals = d3.rollup(
    filteredArrivals,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Update each station with traffic data
  return stations.map((station) => {
    const id = station.short_name;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    station.flowRatio =
      station.totalTraffic > 0
        ? station.departures / station.totalTraffic
        : 0.5;
    return station;
  });
}

// Helper function to get circle coordinates based on station location
function getStationCoordinates(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// Wait for map to load before adding data
map.on("load", async () => {
  console.log("Map loaded, adding data layers...");

  // Add bike lanes for Boston
  map.addSource("boston_bike_network", {
    type: "geojson",
    data: "https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson",
  });

  map.addLayer({
    id: "boston_bike_lanes",
    type: "line",
    source: "boston_bike_network",
    paint: {
      "line-color": "#4CAF50",
      "line-width": 3,
      "line-opacity": 0.7,
    },
  });

  // Add bike lanes for Cambridge
  map.addSource("cambridge_bike_network", {
    type: "geojson",
    data: "https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson",
  });

  map.addLayer({
    id: "cambridge_bike_lanes",
    type: "line",
    source: "cambridge_bike_network",
    paint: {
      "line-color": "#4CAF50",
      "line-width": 3,
      "line-opacity": 0.7,
    },
  });

  // Load BlueBikes station data
  console.log("Loading station data...");
  let stationData;
  try {
    const stationsUrl =
      "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
    stationData = await d3.json(stationsUrl);
    console.log(`Loaded ${stationData.data.stations.length} stations`);
  } catch (error) {
    console.error("Error loading station data:", error);
    return;
  }

  // Load BlueBikes trip data
  console.log("Loading trip data...");
  let trips;
  try {
    const tripsUrl =
      "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
    trips = await d3.csv(tripsUrl, (trip) => {
      // Parse dates and organize trips by time for optimization
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);

      // Add to minute arrays for optimization
      const startMinute = minutesSinceMidnight(trip.started_at);
      departuresByMinute[startMinute].push(trip);

      const endMinute = minutesSinceMidnight(trip.ended_at);
      arrivalsByMinute[endMinute].push(trip);

      return trip;
    });
    console.log(`Loaded ${trips.length} trips`);
  } catch (error) {
    console.error("Error loading trip data:", error);
    return;
  }

  // Process initial station traffic data
  const stations = computeStationTraffic(
    stationData.data.stations,
    trips,
    true
  );

  // Create scale for circle radius based on traffic
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // Create scale for determining station flow color
  const flowScale = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

  // Select SVG for visualization
  const svg = d3.select("#map").select("svg");

  // First, make sure SVG allows pointer events on circles
  svg.style("pointer-events", "none");

  // Create circles for each station
  const circles = svg
    .selectAll("circle")
    .data(stations, (d) => d.short_name)
    .enter()
    .append("circle")
    .attr("r", (d) => radiusScale(d.totalTraffic))
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.85)
    .style("--departure-ratio", (d) => flowScale(d.flowRatio))
    .style("pointer-events", "all"); // Ensure circles can be interacted with

  // Add titles for tooltips (properly)
  circles.append("title").text(
    (d) => `${d.NAME}: ${d.totalTraffic} total trips
${d.departures} departures, ${d.arrivals} arrivals`
  );

  // Function to update circle positions when map moves
  function updateCirclePositions() {
    circles
      .attr("cx", (d) => getStationCoordinates(d).cx)
      .attr("cy", (d) => getStationCoordinates(d).cy);
  }

  // Set initial positions
  updateCirclePositions();

  // Update positions on map interaction
  map.on("move", updateCirclePositions);
  map.on("zoom", updateCirclePositions);
  map.on("resize", updateCirclePositions);

  // Get time filter UI elements
  const timeSlider = document.getElementById("time-slider");
  const selectedTimeDisplay = document.getElementById("selected-time");
  const anyTimeLabel = document.getElementById("any-time");

  // Function to update display based on slider value
  function updateTimeFilter() {
    const timeFilter = Number(timeSlider.value);

    // Update UI elements
    if (timeFilter === -1) {
      selectedTimeDisplay.textContent = "";
      anyTimeLabel.style.display = "block";
    } else {
      selectedTimeDisplay.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = "none";
    }

    // Update visualization with filtered data
    updateVisualization(timeFilter);
  }

  // Function to update visualization based on time filter
  function updateVisualization(timeFilter) {
    // Adjust scale based on filter for better visibility
    if (timeFilter === -1) {
      radiusScale.range([0, 25]);
    } else {
      radiusScale.range([3, 50]);
    }

    // Calculate filtered station data
    const filteredStations = computeStationTraffic(
      stationData.data.stations,
      trips,
      true,
      timeFilter
    );

    // Update circle properties
    circles
      .data(filteredStations, (d) => d.short_name)
      .join("circle")
      .attr("r", (d) => radiusScale(d.totalTraffic))
      .style("--departure-ratio", (d) => flowScale(d.flowRatio))
      .style("pointer-events", "all"); // Ensure circles maintain pointer events

    // Update tooltips after join
    circles.select("title").text(
      (d) => `${d.NAME}: ${d.totalTraffic} total trips
${d.departures} departures, ${d.arrivals} arrivals`
    );
  }

  // Set up time slider event listener
  timeSlider.addEventListener("input", updateTimeFilter);

  // Initialize time display
  updateTimeFilter();

  console.log("Visualization setup complete");
});
