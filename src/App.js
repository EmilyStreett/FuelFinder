//import React, {useState} from 'react';
//import './App.css';
//import './server.js';
const React = require('react');
const { useState, useEffect } = React;
require('./App.css');

function App() {
  // State variables
  const [zipCode, setZipCode] = useState('21727');
  const [stateCode, setStateCode] = useState('MD');
  const [fuelType, setFuelType] = useState('regular');
  const [stations, setStations] = useState([]);
  const [nationalData, setNationalData] = useState(null);
  const [stateData, setStateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchType, setSearchType] = useState('local'); // 'local', 'state', 'national', or 'trends'
  const [sortOrder, setSortOrder] = useState('asc');
  const [maxDistance, setMaxDistance] = useState(25);
  const [trendsDays, setTrendsDays] = useState(30);
  const [trendData, setTrendData] = useState(null);
  const [trendType, setTrendType] = useState('national'); // 'national' or 'state'
  const [databaseStats, setDatabaseStats] = useState(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ lat: null, lng: null });

  // Fetch local station data by zip code
  const fetchLocalStations = async () => {
    setLoading(true);
    setError(null);
    try {
      let url;
      
      if (usingCurrentLocation && currentLocation.lat && currentLocation.lng) {
        url = `http://localhost:5000/api/gas-prices/geo?lat=${currentLocation.lat}&lng=${currentLocation.lng}&maxDistance=${maxDistance}&fuelType=${fuelType}&sort=${sortOrder}`;
      } else {
        url = `http://localhost:5000/api/gas-prices?zip=${zipCode}&maxDistance=${maxDistance}&fuelType=${fuelType}&sort=${sortOrder}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch local gas stations');
      }
      const data = await response.json();
      setStations(data);
    } catch (err) {
      setError(err.message);
      setStations([]);
    } finally {
      setLoading(false);
    }
  };
  // Fetch national gas price data
  const fetchNationalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/gas-prices/national');
      if (!response.ok) {
        throw new Error('Failed to fetch national gas price data');
      }
      const data = await response.json();
      setNationalData(data);

    } catch (err) {
      setError(err.message);
      setNationalData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch state-specific gas price data
  const fetchStateData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/gas-prices/state/${stateCode}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch gas price data for ${stateCode}`);
      }
      const data = await response.json();
      setStateData(data);
    } catch (err) {
      setError(err.message);
      setStateData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch price trends data
  const fetchTrendData = async () => {
    setLoading(true);
    setError(null);
    try {
      let url;
      if (trendType === 'national') {
        url = `http://localhost:5000/api/gas-prices/trends/national?days=${trendsDays}`;
      } else {
        url = `http://localhost:5000/api/gas-prices/trends/state/${stateCode}?days=${trendsDays}&fuelType=${fuelType}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch trend data`);
      }
      const data = await response.json();
      setTrendData(data);
    } catch (err) {
      setError(err.message);
      setTrendData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch database stats
  const fetchDatabaseStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/stats');
      if (response.ok) {
        const data = await response.json();
        setDatabaseStats(data);
      }
    } catch (err) {
      console.error("Could not fetch database stats:", err);
    }
  };

  // Get user's current location
  const getCurrentLocation = () => {
    setError(null);
    if (navigator.geolocation) {
      setUsingCurrentLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          setError(`Location error: ${err.message}`);
          setUsingCurrentLocation(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser");
      setUsingCurrentLocation(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  // Handle search button click
  const handleSearch = () => {
    if (searchType === 'local') {
      fetchLocalStations();
    } else if (searchType === 'state') {
      fetchStateData();
    } else if (searchType === 'trends') {
      fetchTrendData();
    } else {
      fetchNationalData();
    }
  };

  // Format price with dollar sign
  const formatPrice = (price) => {
    if (!price || isNaN(price)) return 'N/A';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  // Render local station results
  const renderLocalResults = () => {
    if (loading) return <div className="loading">Loading gas prices...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!stations || stations.length === 0) 
      return <div className="no-results">No gas stations found {usingCurrentLocation ? "near your location" : `for ZIP code ${zipCode}`}</div>;

    return (
      <div>
        <h2>Gas Prices {usingCurrentLocation ? "Near You" : `Near ${zipCode}`}</h2>
        <p>Showing prices for {fuelType} fuel within {maxDistance} miles</p>
        
        {stations.map((station) => (
          <div key={station.id} className="bubble station-card">
            <div className="station-header">
              <h3>{station.name}</h3>
              <span className="price-tag">{formatPrice(station.price)}</span>
            </div>
            <p>{station.address}, {station.city}, {station.state}</p>
            <div className="station-details">
              <p>{station.brand || "Independent"}</p>
              {/*<p>{station.distance ? `${station.distance.toFixed(1)} miles away` : ""}</p> */}
            </div>
            {/*<p className="last-updated">Last updated: {new Date(station.lastUpdate).toLocaleDateString()}</p>*/}
          </div>
        ))}
      </div>
    );
  };

  // Render national data results
  const renderNationalResults = () => {
    if (loading) return <div className="loading">Loading national gas prices...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!nationalData) return <div className="no-results">No national data available</div>;

    return (
      <div>
        <h2>National Gas Prices</h2>
        <div className="bubble national-card">
          <h3>Regular Gasoline - National Average</h3>
          <p className="price"><strong>Price: {formatPrice(nationalData.regular.US)}</strong></p>
          <p>Last Updated: {nationalData.latestDate?.regular}</p>
        </div>
        
        <h3>Regional Regular Gas Prices</h3>
        <div className="region-grid">
          {Object.entries(nationalData.regular)
            .filter(([region]) => region !== 'US')
            .map(([region, price]) => (
              <div key={region} className="bubble region-card">
                <h3>{region}</h3>
                <p className="price"><strong>{formatPrice(price)}</strong></p>
              </div>
            ))}
        </div>
          
        <h3>Other Fuel Types - National Average</h3>
        <div className="fuel-type-grid">
          <div className="bubble fuel-card">
            <h3>Midgrade</h3>
            <p className="price"><strong>{formatPrice(nationalData.midgrade.US)}</strong></p>
          </div>
          <div className="bubble fuel-card">
            <h3>Premium</h3>
            <p className="price"><strong>{formatPrice(nationalData.premium.US)}</strong></p>
          </div>
          <div className="bubble fuel-card">
            <h3>Diesel</h3>
            <p className="price"><strong>{formatPrice(nationalData.diesel.US)}</strong></p>
          </div>
        </div>
        
        {databaseStats && (
          <div className="stats-section">
            <h3>Database Statistics</h3>
            <div className="bubble stats-card">
              <p><strong>{databaseStats.stations}</strong> stations in database</p>
              <p><strong>{databaseStats.states}</strong> states covered</p>
              <p>Last database update: {new Date(databaseStats.lastUpdate).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render state data results
  const renderStateResults = () => {
    if (loading) return <div className="loading">Loading state gas prices...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!stateData) return <div className="no-results">No data available for {stateCode}</div>;

    return (
      <div>
        <h2>Gas Prices for {stateData.state}</h2>
        <p>Based on data from {stateData.stations} stations</p>
        
        <div className="fuel-type-grid">
          <div className="bubble fuel-card">
            <h3>Regular</h3>
            <p className="price"><strong>{formatPrice(stateData.regular)}</strong></p>
          </div>
          <div className="bubble fuel-card">
            <h3>Midgrade</h3>
            <p className="price"><strong>{formatPrice(stateData.midgrade)}</strong></p>
          </div>
          <div className="bubble fuel-card">
            <h3>Premium</h3>
            <p className="price"><strong>{formatPrice(stateData.premium)}</strong></p>
          </div>
          <div className="bubble fuel-card">
            <h3>Diesel</h3>
            <p className="price"><strong>{formatPrice(stateData.diesel)}</strong></p>
          </div>
        </div>
        
        <p>Last Updated: {stateData.updateDate ? new Date(stateData.updateDate).toLocaleDateString() : "N/A"}</p>
        {/*
        <div className="view-trends">
          <button 
            onClick={() => {
              setSearchType('trends');
              setTrendType('state');
              setTrendsDays(30);
            }}
            className="trends-button"
          >
            View Price Trends for {stateData.state}
          </button>
        </div>*/}
      </div>
    );
  };
  
  // Render trend data
  const renderTrendResults = () => {
    if (loading) return <div className="loading">Loading price trends...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!trendData) return <div className="no-results">No trend data available</div>;
    
    // For state trends, format is different from national trends
    if (trendType === 'state') {
      return (
        <div>
          <h2>Price Trends for {stateCode}</h2>
          <p>Showing {trendsDays} day history for {fuelType} fuel</p>
          
          <div className="trend-chart">
            {/* Here you would render a chart using the trendData */}
            {/* For now we'll just show the raw data */}
            <div className="trend-data-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {trendData.map((dataPoint, index) => (
                    <tr key={index}>
                      <td>{new Date(dataPoint.date).toLocaleDateString()}</td>
                      <td>{formatPrice(dataPoint.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
    console.log(nationalData);
    // For national trends
    return (
      <div>
        <h2>National Price Trends</h2>
        <p>Showing {trendsDays} day history</p>
        
        {/* Tabs for different fuel types */}
        <div className="fuel-tabs">
          <button className={fuelType === 'regular' ? 'active' : ''} onClick={() => setFuelType('regular')}>Regular</button>
          <button className={fuelType === 'midgrade' ? 'active' : ''} onClick={() => setFuelType('midgrade')}>Midgrade</button>
          <button className={fuelType === 'premium' ? 'active' : ''} onClick={() => setFuelType('premium')}>Premium</button>
          <button className={fuelType === 'diesel' ? 'active' : ''} onClick={() => setFuelType('diesel')}>Diesel</button>
        </div>
        
        <div className="trend-chart">
          {/* Here you would render a chart using the selected fuel type data */}
          {/* For now we'll just show the raw data */}
          <div className="trend-data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {trendData[fuelType]?.map((dataPoint, index) => (
                  <tr key={index}>
                    <td>{new Date(dataPoint.date).toLocaleDateString()}</td>
                    <td>{formatPrice(dataPoint.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <div className="logo">FuelFinder</div>
          <nav className="nav">
            <ul>
              <li><a href="#local" onClick={() => setSearchType('local')}>Find Local Prices</a></li>
              <li><a href="#state" onClick={() => setSearchType('state')}>State Averages</a></li>
              {/*<li><a href="#national" onClick={() => setSearchType('national')}>National Trends</a></li>
              <li><a href="#trends" onClick={() => {setSearchType('trends'); setTrendType('national');}}>Price History</a></li>*/}
            </ul>
          </nav>
        </div>
      </header>

      <section className="hero-image">
        {/*<img src="/api/placeholder/1200/300" alt="Gas station" />*/}
        <div className="hero-text">
          <h1>Find the Best Gas Prices</h1>
          <p>Compare prices and save on fuel costs</p>
        </div>
      </section>

      <main className="main-content">
        <div className="content">
          <aside className="sidebar">
            {searchType === 'local' && (
              <>
                <h2>Search for Local Prices</h2>
                
                {!usingCurrentLocation && (
                  <>
                    <label htmlFor="zipCode">Zip Code:</label>
                    <input 
                      type="text" 
                      id="zipCode" 
                      value={zipCode} 
                      onChange={(e) => setZipCode(e.target.value)}
                    />
                  </>
                )}
                
                <label htmlFor="maxDistance">Distance (miles):</label>
                <input 
                  type="range" 
                  id="maxDistance" 
                  min="5" 
                  max="50" 
                  value={maxDistance} 
                  onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                />
                <span>{maxDistance} miles</span>
                
                <label htmlFor="sortOrder">Sort by:</label>
                <select 
                  id="sortOrder" 
                  value={sortOrder} 
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="asc">Price: Low to High</option>
                  <option value="desc">Price: High to Low</option>
                  {usingCurrentLocation && <option value="distance">Distance</option>}
                </select>
              </>
            )}
            
            {searchType === 'state' && (
              <>
                <h2>State Average Prices</h2>
                <label htmlFor="stateCode">State Code:</label>
                <input 
                  type="text" 
                  id="stateCode" 
                  value={stateCode} 
                  onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                  maxLength="2"
                />
                <p>Enter a two-letter state code</p>
              </>
            )}
            
            {searchType === 'national' && (
              <>
                <h2>National Gas Price Data</h2>
                <p>View national averages and regional trends for various fuel types.</p>
              </>
            )}
            
            {searchType === 'trends' && (
              <>
                <h2>Price History Trends</h2>
                
                <div className="trend-options">
                  <div className="option">
                    <input 
                      type="radio" 
                      id="national-trends" 
                      name="trend-type" 
                      checked={trendType === 'national'}
                      onChange={() => setTrendType('national')}
                    />
                    <label htmlFor="national-trends">National Trends</label>
                  </div>
                  
                  <div className="option">
                    <input 
                      type="radio" 
                      id="state-trends" 
                      name="trend-type" 
                      checked={trendType === 'state'}
                      onChange={() => setTrendType('state')}
                    />
                    <label htmlFor="state-trends">State Trends</label>
                  </div>
                </div>
                
                {trendType === 'state' && (
                  <>
                    <label htmlFor="trendStateCode">State Code:</label>
                    <input 
                      type="text" 
                      id="trendStateCode" 
                      value={stateCode} 
                      onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                      maxLength="2"
                    />
                  </>
                )}
                
                <label htmlFor="trendsDays">Time Period:</label>
                <select 
                  id="trendsDays" 
                  value={trendsDays} 
                  onChange={(e) => setTrendsDays(parseInt(e.target.value))}
                >
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </>
            )}
            
            <button className="search-button" onClick={handleSearch}>
              Search
            </button>
            
            {(searchType === 'local' || searchType === 'state' || (searchType === 'trends' && trendType === 'state')) && (
              <>
                <label htmlFor="fuelType">Fuel Type:</label>
                <select 
                  id="fuelType" 
                  value={fuelType} 
                  onChange={(e) => setFuelType(e.target.value)}
                >
                  <option value="regular">Regular</option>
                  <option value="midgrade">Midgrade</option>
                  <option value="premium">Premium</option>
                  <option value="diesel">Diesel</option>
                </select>
              </>
            )}
          </aside>

          <section className="results">
            {searchType === 'local' && renderLocalResults()}
            {searchType === 'state' && renderStateResults()}
            {searchType === 'national' && renderNationalResults()}
            {searchType === 'trends' && renderTrendResults()}
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>FuelFinder</h3>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Privacy Policy</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Data Sources</h3>
            <ul>
              <li><a href="https://www.barchart.com/" target="_blank" rel="noopener noreferrer">Barchart API</a></li>
              {/*<li><a href="https://www.eia.gov/" target="_blank" rel="noopener noreferrer">Energy Information Administration</a></li>*/}
            </ul>
          </div>
          <div className="footer-section">
            <h3>Features</h3>
            <ul>
              <li><a href="#local">Local Gas Prices</a></li>
              <li><a href="#state">State Averages</a></li>
              {/*<li><a href="#national">National Trends</a></li>
              <li><a href="#trends">Price History</a></li>*/}
            </ul>
          </div>
        </div>
        <div className="copyright">
          &copy; {new Date().getFullYear()} FuelFinder. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;