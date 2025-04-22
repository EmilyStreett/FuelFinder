//file to handle the connection between my database and app
//const mysql = require();


//version of my app that works
import React, { useState } from "react";
import "./App.css";

const mockGasStations = [
  { id: 1, name: "Gas Station 1", address: "123 Main St", price: 3.45 },
  { id: 2, name: "Gas Station 2", address: "456 Elm St", price: 3.55 },
  { id: 3, name: "Gas Station 3", address: "789 Oak St", price: 3.35 },
  { id: 4, name: "Gas Station 4", address: "321 Pine St", price: 3.65 },
  { id: 5, name: "Gas Station 5", address: "654 Maple St", price: 3.25 },
  { id: 6, name: "Gas Station 6", address: "987 Cedar St", price: 3.75 },
];

function App() {
  const [zip, setZip] = useState("");
  const [sortOrder, setSortOrder] = useState("lowToHigh");
  const [stations, setStations] = useState(mockGasStations);

  // Sort stations based on user selection
  const sortedStations = [...stations].sort((a, b) =>
    sortOrder === "lowToHigh" ? a.price - b.price : b.price - a.price
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1>Gas Station Finder</h1>
      </header>
      <div className="content">
        <div className="sidebar">
          <label>Enter Zip Code:</label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="e.g., 12345"
          />
          <label>Sort By:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="lowToHigh">Price: Low to High</option>
            <option value="highToLow">Price: High to Low</option>
          </select>
        </div>
        <div className="results">
          {sortedStations.map((station) => (
            <div key={station.id} className="bubble">
              <h3>{station.name}</h3>
              <p>{station.address}</p>
              <p>Price: ${station.price.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;


//version that will work when implementing the api

import React, { useState, useEffect } from "react";
import "./App.css";
import { getGasStations } from "./database"; // Import the database function


function App() {
  const [zip, setZip] = useState("");
  const [sortOrder, setSortOrder] = useState("lowToHigh");
  const [stations, setStations] = useState([]);

  useEffect(() => {
    async function fetchStations() {
      const data = await getGasStations();
      setStations(data);
    }
    fetchStations();
  }, []);

  const sortedStations = [...stations].sort((a, b) =>
    sortOrder === "lowToHigh" ? a.price - b.price : b.price - a.price
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1>Gas Station Finder</h1>
      </header>
      <div className="content">
        <div className="sidebar">
          <label>Enter Zip Code:</label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="e.g., 12345"
          />
          <label>Sort By:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="lowToHigh">Price: Low to High</option>
            <option value="highToLow">Price: High to Low</option>
          </select>
        </div>
        <div className="results">
          {sortedStations.map((station) => (
            <div key={station.id} className="bubble">
              <h3>{station.name}</h3>
              <p>{station.address}</p>
              <p>Price: ${station.price.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
