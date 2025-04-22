const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const BARCHART_API_KEY = '09a41430f0a79b895cb7477bce8d77f7';
const BARCHART_BASE_URL = 'http://ondemand.websol.barchart.com';

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root', 
  password: '1j*Y*0205864B', 
  database: 'finalProject', 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

/**
 * Fetches fuel prices from Barchart API based on provided parameters
 * @param {Object} params - Query parameters for the API
 * @returns {Array|null} - Array of station results or null if error
 */
async function getFuelPrices(params = {}) {

  try {
    // Set default parameters if not provided
    const queryParams = {
      apikey: BARCHART_API_KEY,
      totalLocations: params.totalLocations || 30,
      ...params
    };

    const response = await axios.get(`${BARCHART_BASE_URL}/getFuelPrices.json`, {
      params: queryParams
    });

    //console.log('API response structure:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.status && response.data.status.code === 200 && response.data.results) {
      return response.data.results;
    } else {
      throw new Error(`No valid data returned from Barchart API: ${JSON.stringify(response.data.status || {})}`);
    }
  } catch (error) {
    console.error(`Error fetching fuel prices:`, error.message);
    return null;
  }
}

/**
 * Fetch fuel prices by zip code
 * @param {String} zipCode - ZIP code to search
 * @param {Number} maxDistance - Maximum distance in miles
 * @returns {Array|null} - Array of station results or null if error
 */
async function getFuelPricesByZipCode(zipCode, maxDistance = 100) {
  return getFuelPrices({
    zipCode,
    maxDistance
  });
}

/**
 * Fetch fuel prices by state
 * @param {String} state - Two-letter state code
 * @returns {Array|null} - Array of station results or null if error
 */
async function getFuelPricesByState(state) {
  return getFuelPrices({
    state,
    totalLocations: 50
  });
}

/**
 * Fetch fuel prices by geographic coordinates
 * @param {Number} latitude - Latitude
 * @param {Number} longitude - Longitude
 * @param {Number} maxDistance - Maximum distance in miles
 * @returns {Array|null} - Array of station results or null if error
 
async function getFuelPricesByCoordinates(latitude, longitude, maxDistance = 100) {
  return getFuelPrices({
    latitude,
    longitude,
    maxDistance
  });
}
*/
/**
 * Save station price data to the database
 * @param {Array} stationList - List of stations from Barchart API
 * @returns {Boolean} - Success or failure
 */
async function saveStationPriceData(stationList) {
  if (!stationList || stationList.length === 0) {
    console.log('No station data to save');
    return false;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const station of stationList) {
      // Insert into StationGasPrices table (direct API data storage)
      const regularPrice = findPriceByType(station.prices, "Regular Gas");
      const midgradePrice = findPriceByType(station.prices, "Midgrade Gas");
      const premiumPrice = findPriceByType(station.prices, "Premium Gas");
      const dieselPrice = findPriceByType(station.prices, "Diesel");

      station.regularPrice = regularPrice;
      station.midgradePrice = midgradePrice;
      station.premiumPrice = premiumPrice;
      station.dieselPrice = dieselPrice;
      
      //option 2
      /**
      const priceObj = station.price || {
        regular: station.regular, 
        midgrade: station.midgrade, 
        premium: station.premium,
        diesel: station.diesel
        */
        //option 1
        /**
        { type: 'Regular', price: station.regular },
        { type: 'Mid-grade', price: station.midgrade },
        { type: 'Premium', price: station.premium },
        { type: 'Diesel', price: station.diesel }
         
      };
*/
      await connection.execute(
        `INSERT INTO StationGasPrices (
          locationId, location, company, address, zipCode, city, state,
          latitude, longitude, regular, midgrade, premium, diesel, price_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          station.locationId || null,
          station.location || null,
          station.company || null,
          station.address || null,
          station.zipCode || null,
          station.city || null,
          station.state || null,
          station.latitude || null,
          station.longitude || null,
          regularPrice ? parseFloat(regularPrice) : null,
          midgradePrice ? parseFloat(midgradePrice) : null,
          premiumPrice ? parseFloat(premiumPrice) : null,
          dieselPrice ? parseFloat(dieselPrice) : null,
          station.lastUpdateTimestamp ? new Date(station.lastUpdateTimestamp).toISOString().slice(0,19).replace('T', ' '):timestamp
          /**
          station.regular ? parseFloat(station.regular) : null,
          station.midgrade ? parseFloat(station.midgrade) : null,
          station.premium ? parseFloat(station.premium) : null,
          station.diesel ? parseFloat(station.diesel) : null,
          station.lastUpdateTimestamp || timestamp 
          */
        ]
      );
      console.log(`Inserted ${station.location} with prices:`, {
        regular: regularPrice,
        midgrade: midgradePrice,
        premium: premiumPrice,
        diesel: dieselPrice
      });

      // 1. Insert or update location
      const [locationResult] = await connection.execute(
        `INSERT INTO Locations (latitude, longitude, address, city, state, zip_code)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [
          station.latitude || 0,
          station.longitude || 0,
          station.address || '',
          station.city || '',
          station.state || '',
          station.zipCode || ''
        ]
      );

      const locationId = locationResult.insertId;

      // 2. Insert or update gas station
      const [stationResult] = await connection.execute(
        `INSERT INTO GasStations (name, brand, location_id, phone_number)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [
          station.location || 'Unknown Station',
          station.company || null,
          locationId,
          station.phone || null
        ]
      );

      const stationId = stationResult.insertId;

      // 3. Insert fuel prices for each available fuel type
      /**
      station.regularPrice = regularPrice;
      station.midgradePrice = midgradePrice;
      station.premiumPrice = premiumPrice;
      station.dieselPrice = dieselPrice;
*/
      /**const fuelTypes = [
        { type: 'regular', price: station.regularPrice },
        { type: 'midgrade', price: station.midgradePrice },
        { type: 'premium', price: station.premiumPrice },
        { type: 'diesel', price: station.dieselPrice }
      ];*/
      
      if (station.prices && Array.isArray(station.prices)) {
        for (const priceItem of station.prices) {
          let fuelType = "unknown";

          if (priceItem.seriesName.includes("Regular Gas")) {
            fuelType = "regular";
          } else if (priceItem.seriesName.includes("Midgrade Gas")) {
            fuelType = "midgrade";
          } else if (priceItem.seriesName.includes("Premium Gas")) {
            fuelType = "premium";
          } else if (priceItem.seriesName.includes("Diesel")) {
            fuelType = "diesel";
          } else {
            // Skip other fuel types like DEF, Propane, etc.
            continue;
          }

          if (priceItem.price){
            await connection.execute(
              `INSERT INTO FuelPrices(station_id, fuel_type, price, price_date)
              VALUES (?,?,?,?)`,
              [
                stationId, 
                fuelType, 
                parseFloat(priceItem.price), 
                priceItem.date ? Date(priceItem.date).toISOString().slice(0,19).replace('T', ' ') : timestamp
              ]
            );
          }
          /**
      for (const { type, price } of fuelTypes) {
        if (price) {
          await connection.execute(
            `INSERT INTO FuelPrices (station_id, fuel_type, price, price_date)
             VALUES (?, ?, ?, ?)`,
            [stationId, type, parseFloat(price), station.lastUpdateTimestamp || timestamp]
          );
        } */
      }
    }
  }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('Error saving station-level data:', error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Helper function to find price by fuel type in the prices array
 * @param {Array}
 * @param {String}
 * @returns {Number|null}
 */
function findPriceByType(prices, fuelType){
  if(!prices || !Array.isArray(prices)) return null;
  const priceObj = prices.find(p =>
    p.seriesName && p.seriesName.includes(fuelType)
  );
  return priceObj ? priceObj.price : null;
}


/**
 * Save national price data to the database
 * @param {Object} nationalData - Aggregated national pricing data
 * @returns {Boolean} - Success or failure
 */
async function saveNationalPriceData(nationalData) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Save US national averages
    const fuelTypes = ['regular', 'midgrade', 'premium', 'diesel'];
    for (const fuelType of fuelTypes) {
      if (nationalData[fuelType] && nationalData[fuelType].US) {
        await connection.execute(
          `INSERT INTO NationalGasPrices (region, fuel_type, price, price_date)
           VALUES (?, ?, ?, ?)`,
          ['US', fuelType, nationalData[fuelType].US, timestamp]
        );
      }
    }

    // Save regional data for each fuel type
    for (const fuelType of fuelTypes) {
      if (nationalData[fuelType]) {
        for (const [region, price] of Object.entries(nationalData[fuelType])) {
          if (region !== 'US' && price) {
            await connection.execute(
              `INSERT INTO NationalGasPrices (region, fuel_type, price, price_date)
               VALUES (?, ?, ?, ?)`,
              [region, fuelType, price, timestamp]
            );
          }
        }
      }
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('Error saving national price data:', error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Get representative ZIP codes for a state to sample fuel prices
 * @param {String} state - Two-letter state code
 * @returns {Array} - Array of ZIP codes
 */
function getRepresentativeZipCodesForState(state) {
  const stateZipCodes = {
    'AL': ['35203', '36104'],   // Birmingham, Montgomery
    'AK': ['99501', '99701'],   // Anchorage, Fairbanks
    'AZ': ['85004', '85701'],   // Phoenix, Tucson
    'AR': ['72201', '72701'],   // Little Rock, Fayetteville
    'CA': ['90012', '94102', '95814'], // Los Angeles, San Francisco, Sacramento
    'CO': ['80202', '80903'],   // Denver, Colorado Springs
    'CT': ['06103', '06510'],   // Hartford, New Haven
    'DE': ['19801', '19901'],   // Wilmington, Dover
    'FL': ['32301', '33131', '32801'], // Tallahassee, Miami, Orlando
    'GA': ['30303', '31401'],   // Atlanta, Savannah
    'HI': ['96813', '96761'],   // Honolulu, Maui
    'ID': ['83702', '83814'],   // Boise, Coeur d'Alene
    'IL': ['60602', '62701'],   // Chicago, Springfield
    'IN': ['46204', '47708'],   // Indianapolis, Evansville
    'IA': ['50309', '52401'],   // Des Moines, Cedar Rapids
    'KS': ['66603', '67202'],   // Topeka, Wichita
    'KY': ['40202', '41011'],   // Louisville, Covington
    'LA': ['70802', '71101'],   // Baton Rouge, Shreveport
    'ME': ['04101', '04330'],   // Portland, Augusta
    'MD': ['21201', '20850', '21727'],   // Baltimore, Rockville, Emmittsburg, Frederick
    'MA': ['02108', '02210'],   // Boston, Boston Seaport
    'MI': ['48933', '49503'],   // Lansing, Grand Rapids
    'MN': ['55101', '55802'],   // St. Paul, Duluth
    'MS': ['39201', '39530'],   // Jackson, Biloxi
    'MO': ['64106', '63103'],   // Kansas City, St. Louis
    'MT': ['59601', '59801'],   // Helena, Missoula
    'NE': ['68508', '68102'],   // Lincoln, Omaha
    'NV': ['89501', '89101'],   // Reno, Las Vegas
    'NH': ['03301', '03801'],   // Concord, Portsmouth
    'NJ': ['08608', '07102'],   // Trenton, Newark
    'NM': ['87501', '87102'],   // Santa Fe, Albuquerque
    'NY': ['12207', '10007', '14202'], // Albany, NYC, Buffalo
    'NC': ['27601', '28202'],   // Raleigh, Charlotte
    'ND': ['58501', '58102'],   // Bismarck, Fargo
    'OH': ['43215', '44113'],   // Columbus, Cleveland
    'OK': ['73102', '74103'],   // Oklahoma City, Tulsa
    'OR': ['97204', '97401'],   // Portland, Eugene
    'PA': ['17101', '19107'],   // Harrisburg, Philadelphia
    'RI': ['02903', '02840'],   // Providence, Newport
    'SC': ['29201', '29401'],   // Columbia, Charleston
    'SD': ['57501', '57104'],   // Pierre, Sioux Falls
    'TN': ['37219', '38103'],   // Nashville, Memphis
    'TX': ['78701', '75201', '77002'], // Austin, Dallas, Houston
    'UT': ['84111', '84601'],   // Salt Lake City, Provo
    'VT': ['05602', '05401'],   // Montpelier, Burlington
    'VA': ['23219', '22314'],   // Richmond, Alexandria
    'WA': ['98507', '98101'],   // Olympia, Seattle
    'WV': ['25301', '26003'],   // Charleston, Wheeling
    'WI': ['53703', '53202'],   // Madison, Milwaukee
    'WY': ['82001', '82601'],   // Cheyenne, Casper
    'DC': ['20001', '20036']    // Washington DC
  };
  
  return stateZipCodes[state.toUpperCase()] || ['60606', '10001']; // Default to Chicago and NYC
}

/**
 * API endpoint to get gas prices by state
 */
app.get('/api/gas-prices/state/:state', async (req, res) => {
  try {
    const state = req.params.state.toUpperCase();
    
    // Option 1: Use the state parameter directly with the API
    const stateResults = await getFuelPricesByState(state);
    
    // Option 2: If direct state query doesn't provide good results, use representative ZIP codes
    let zipCodeResults = [];
    if (!stateResults || stateResults.length < 5) {
      const stateZipCodes = getRepresentativeZipCodesForState(state);
      zipCodeResults = await Promise.all(
        stateZipCodes.map(zipCode => getFuelPricesByZipCode(zipCode, 150))
      );
    }

    // Combine results from both methods
    const allStations = [...(stateResults || [])];
    zipCodeResults.forEach(zipResult => {
      if (zipResult && zipResult.length > 0) {
        allStations.push(...zipResult);
      }
    });

    // Filter to only include stations in the requested state
    const stateStations = allStations.filter(station => 
      station.state && station.state.toUpperCase() === state
    );

    if (stateStations.length === 0) {
      return res.status(404).json({ 
        error: `No gas stations found in ${state}`,
        message: "Try searching for a different state or by ZIP code instead"
      });
    }

    // Calculate average prices
    const statePrices = {
      regular: [], midgrade: [], premium: [], diesel: []
    };

    stateStations.forEach(station => {
      const regularPrice = findPriceByType(station.prices, "Regular Gas");
      const midgradePrice = findPriceByType(station.prices, "Midgrade Gas");
      const premiumPrice = findPriceByType(station.prices, "Premium Gas");
      const dieselPrice = findPriceByType(station.prices, "Diesel");

      if (regularPrice) statePrices.regular.push(parseFloat(regularPrice));
      if (midgradePrice) statePrices.midgrade.push(parseFloat(midgradePrice));
      if (premiumPrice) statePrices.premium.push(parseFloat(premiumPrice));
      if (dieselPrice) statePrices.diesel.push(parseFloat(dieselPrice));
    });

    const calculateAverage = arr => 
      arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3) : null;

    const averagePrices = {
      state: state,
      region: state,
      stations: stateStations.length,
      updateDate: new Date().toISOString(),
      regular: calculateAverage(statePrices.regular),
      midgrade: calculateAverage(statePrices.midgrade),
      premium: calculateAverage(statePrices.premium),
      diesel: calculateAverage(statePrices.diesel),
      latestDate: {
        regular: new Date().toISOString().split('T')[0]
      }
    };

    // Save data to database
    await saveStationPriceData(stateStations);
    
    res.json(averagePrices);
  } catch (error) {
    console.error(`Error fetching gas prices for state ${req.params.state}:`, error);
    res.status(500).json({ error: `Failed to fetch gas prices for state ${req.params.state}` });
  }
});

/**
 * API endpoint to get national gas price averages
 */
app.get('/api/gas-prices/national', async (req, res) => {
  try {
    // Define regions and their representative states
    const regions = {
      'Northeast': ['NY', 'MA', 'CT', 'RI', 'VT', 'NH', 'ME', 'PA', 'NJ'],
      'Southeast': ['FL', 'GA', 'SC', 'NC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
      'Midwest': ['OH', 'MI', 'IN', 'IL', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
      'Southwest': ['TX', 'OK', 'NM', 'AZ'],
      'West': ['CA', 'NV', 'UT', 'CO', 'WY', 'MT', 'ID', 'WA', 'OR', 'AK', 'HI']
    };

    // Sample states from each region
    const sampleStates = {
      'Northeast': ['NY', 'MA', 'PA', 'MD'],
      'Southeast': ['FL', 'GA', 'NC'],
      'Midwest': ['IL', 'OH', 'MI'],
      'Southwest': ['TX', 'AZ'],
      'West': ['CA', 'WA', 'CO']
    };

    // Fetch data for representative states
    const statePromises = [];
    const stateToRegion = {};

    for (const [region, states] of Object.entries(sampleStates)) {
      for (const state of states) {
        stateToRegion[state] = region;
        statePromises.push(getFuelPricesByState(state));
      }
    }

    const stateResults = await Promise.all(statePromises);

    // Organize data by region
    const regionData = {
      'US': { regular: [], midgrade: [], premium: [], diesel: [] }
    };

    // Initialize regions
    Object.keys(regions).forEach(region => {
      regionData[region] = { regular: [], midgrade: [], premium: [], diesel: [] };
    });

    // Process results for each state
    stateResults.forEach((stateStations, index) => {
      if (!stateStations || stateStations.length === 0) return;

      const state = stateStations[0].state;
      const region = stateToRegion[state] || 'US';

      stateStations.forEach(station => {
        if (station.regular) {
          regionData[region].regular.push(parseFloat(station.regular));
          regionData['US'].regular.push(parseFloat(station.regular));
        }
        if (station.midgrade) {
          regionData[region].midgrade.push(parseFloat(station.midgrade));
          regionData['US'].midgrade.push(parseFloat(station.midgrade));
        }
        if (station.premium) {
          regionData[region].premium.push(parseFloat(station.premium));
          regionData['US'].premium.push(parseFloat(station.premium));
        }
        if (station.diesel) {
          regionData[region].diesel.push(parseFloat(station.diesel));
          regionData['US'].diesel.push(parseFloat(station.diesel));
        }
      });
    });

    // Calculate averages for each region and fuel type
    const calculateAverage = arr => 
      arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3) : null;

    const nationalData = {
      regular: {},
      midgrade: {},
      premium: {},
      diesel: {},
      latestDate: {
        regular: new Date().toISOString().split('T')[0],
        midgrade: new Date().toISOString().split('T')[0],
        premium: new Date().toISOString().split('T')[0],
        diesel: new Date().toISOString().split('T')[0]
      }
    };

    // Calculate averages for each region and fuel type
    Object.entries(regionData).forEach(([region, prices]) => {
      nationalData.regular[region] = calculateAverage(prices.regular);
      nationalData.midgrade[region] = calculateAverage(prices.midgrade);
      nationalData.premium[region] = calculateAverage(prices.premium);
      nationalData.diesel[region] = calculateAverage(prices.diesel);
    });

    // Save the aggregated data
    await saveNationalPriceData(nationalData);
    
    res.json(nationalData);
  } catch (error) {
    console.error('Error fetching national gas prices:', error);
    res.status(500).json({ error: 'Failed to fetch national gas prices' });
  }
});

/**
 * API endpoint to get local gas prices by ZIP code
 */
app.get('/api/gas-prices', async (req, res) => {
  try {
    const zipCode = req.query.zip || '60606';
    const sortOrder = req.query.sort || 'asc';
    const maxDistance = req.query.maxDistance || 25; // Default to 25 miles
    const fuelType = req.query.fuelType?.toLowerCase() || 'regular';
    
    const stationData = await getFuelPricesByZipCode(zipCode, maxDistance);

    if (stationData && stationData.length > 0) {
      const formatted = stationData.map(station => {
        // Get the price for the requested fuel type
        let price = null;
        if (fuelType === 'midgrade') {
          price = findPriceByType(station.prices, "Midgrade Gas");
        } else if (fuelType === 'premium'){
          price = findPriceByType(station.prices, "Premium Gas");
        } else if (fuelType === 'diesel'){
          price = findPriceByType(station.prices, "Diesel");        
        }else{
          price = findPriceByType(station.prices, "Regular Gas"); // Default to regular
        }

        return {
          id: station.locationId,
          name: station.location,
          address: station.address,
          city: station.city,
          state: station.state,
          price: price,
          distance: station.distance,
          latitude: station.latitude,
          longitude: station.longitude,
          brand: station.company,
          lastUpdate: station.lastUpdateTimestamp,
          fuelType // Include which fuel type this price is for
        };
      }).filter(station => station.price !== null); // Filter out stations without the requested fuel type
      
      // Sort by price
      formatted.sort((a, b) => {
        const priceA = parseFloat(a.price) || 0;
        const priceB = parseFloat(b.price) || 0;
        return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
      });

      // Save the raw data to the database
      await saveStationPriceData(stationData);
      
      res.json(formatted);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching station-level gas prices:', error);
    res.status(500).json({ error: 'Failed to fetch gas prices' });
  }
});

/**
 * API endpoint to get details for a specific station
 */
app.get('/api/gas-stations/:stationId', async (req, res) => {
  try {
    const stationId = req.params.stationId;
    
    // Query the database for station data
    const connection = await pool.getConnection();
    try {
      // Get the most recent price data for this station
      const [stationData] = await connection.execute(
        `SELECT * FROM StationGasPrices WHERE locationId = ? ORDER BY price_date DESC LIMIT 1`,
        [stationId]
      );
      
      if (stationData.length === 0) {
        // If not in our database, try to fetch from the API
        const stations = await getFuelPrices({ location: stationId });
        
        if (stations && stations.length > 0) {
          const station = stations[0];
          
          // Save to database
          await saveStationPriceData([station]);
          
          // Return formatted response
          res.json({
            id: station.locationId,
            name: station.location,
            brand: station.company,
            address: station.address,
            city: station.city, 
            state: station.state,
            zipCode: station.zipCode,
            latitude: station.latitude,
            longitude: station.longitude,
            regular: station.regular,
            midgrade: station.midgrade,
            premium: station.premium,
            diesel: station.diesel,
            lastUpdate: station.lastUpdateTimestamp
          });
        } else {
          res.status(404).json({ error: 'Station not found' });
        }
      } else {
        // Format the database response
        const station = stationData[0];
        res.json({
          id: station.locationId,
          name: station.location,
          brand: station.company,
          address: station.address,
          city: station.city,
          state: station.state,
          zipCode: station.zipCode,
          latitude: station.latitude,
          longitude: station.longitude,
          regular: station.regular,
          midgrade: station.midgrade,
          premium: station.premium,
          diesel: station.diesel,
          lastUpdate: station.price_date
        });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching station details:', error);
    res.status(500).json({ error: 'Failed to fetch station details' });
  }
});

/**
 * API endpoint to get price history for a specific station
 */
app.get('/api/gas-stations/:stationId/history', async (req, res) => {
  try {
    const stationId = req.params.stationId;
    const fuelType = req.query.fuelType || 'regular';
    
    const connection = await pool.getConnection();
    try {
      // Query historical price data
      const [priceHistory] = await connection.execute(
        `SELECT price, price_date FROM FuelPrices
         INNER JOIN GasStations ON FuelPrices.station_id = GasStations.id
         WHERE GasStations.google_maps_id = ? AND fuel_type = ?
         ORDER BY price_date DESC
         LIMIT 30`,
        [stationId, fuelType]
      );
      
      if (priceHistory.length === 0) {
        // Try alternate query using locationId instead of google_maps_id
        const [altHistory] = await connection.execute(
          `SELECT ${fuelType} as price, price_date 
           FROM StationGasPrices 
           WHERE locationId = ? AND ${fuelType} IS NOT NULL
           ORDER BY price_date DESC
           LIMIT 30`,
          [stationId]
        );
        
        res.json(altHistory);
      } else {
        res.json(priceHistory);
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

/**
 * Database connection test
 */
async function testDatabaseInsertion() {
  const connection = await pool.getConnection();
  try {
    console.log('Testing direct database insertion...');

    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const testRegion = 'TEST';
    const testPrice = '3.999';

    await connection.execute(
      `INSERT INTO NationalGasPrices (region, fuel_type, price, price_date)
       VALUES (?, 'Regular', ?, ?)`,
      [testRegion, testPrice, timestamp]
    );

    console.log('Test insertion successful!');

    const [rows] = await connection.execute(
      `SELECT * FROM NationalGasPrices WHERE region = ? ORDER BY id DESC LIMIT 1`,
      [testRegion]
    );

    console.log('Retrieved test record:', rows[0]);
    return true;
  } catch (error) {
    console.error('Test database insertion failed:', error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * API endpoint to get national price trends
 */
app.get('/api/gas-prices/trends/national', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const connection = await pool.getConnection();
    try {
      // Get national price trends for the specified time period
      const [trends] = await connection.execute(
        `SELECT region, fuel_type, price, price_date 
        FROM NationalGasPrices 
        WHERE region = 'US' AND price_date >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
        ORDER BY fuel_type, price_date;`
      );
      
      // Format the data by fuel type
      const formattedTrends = {
        regular: [],
        midgrade: [],
        premium: [],
        diesel: []
      };
      
      trends.forEach(record => {
        if (formattedTrends[record.fuel_type.toLowerCase()]) {
          formattedTrends[record.fuel_type.toLowerCase()].push({
            date: record.price_date,
            price: parseFloat(record.price)
          });
        }
      });
      
      res.json(formattedTrends);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching national price trends:', error);
    res.status(500).json({ error: 'Failed to fetch national price trends' });
  }
});

/**
 * API endpoint to get state price trends
 */
app.get('/api/gas-prices/trends/state/:state', async (req, res) => {
  try {
    const state = req.params.state.toUpperCase();
    const days = parseInt(req.query.days) || 30;
    const fuelType = req.query.fuelType?.toLowerCase() || 'regular';
    
    const connection = await pool.getConnection();
    try {
      // Get average prices for the state over time
      const [trends] = await connection.execute(
        `SELECT AVG(${fuelType}) as avg_price, DATE(price_date) as date
         FROM StationGasPrices
         WHERE state = ? AND price_date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND ${fuelType} IS NOT NULL
         GROUP BY DATE(price_date)
         ORDER BY date`,
        [state, days]
      );
      
      res.json(trends.map(record => ({
        date: record.date,
        price: parseFloat(record.avg_price)
      })));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(`Error fetching price trends for state ${req.params.state}:`, error);
    res.status(500).json({ error: `Failed to fetch price trends for state ${req.params.state}` });
  }
});

/**
 * API endpoint to get stats about stations in the database
 */
app.get('/api/stats', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Get total number of unique stations
      const [stationCount] = await connection.execute(
        `SELECT COUNT(DISTINCT locationId) as total FROM StationGasPrices`
      );
      
      // Get number of states covered
      const [stateCount] = await connection.execute(
        `SELECT COUNT(DISTINCT state) as total FROM StationGasPrices`
      );
      
      // Get latest update time
      const [latestUpdate] = await connection.execute(
        `SELECT MAX(price_date) as latest FROM StationGasPrices`
      );
      
      // Get average prices nationwide
      const [avgPrices] = await connection.execute(
        `SELECT 
          AVG(regular) as avg_regular,
          AVG(midgrade) as avg_midgrade,
          AVG(premium) as avg_premium,
          AVG(diesel) as avg_diesel
         FROM StationGasPrices
         WHERE price_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      );
      
      res.json({
        stations: stationCount[0].total,
        states: stateCount[0].total,
        lastUpdate: latestUpdate[0].latest,
        averagePrices: {
          regular: parseFloat(avgPrices[0].avg_regular).toFixed(3),
          midgrade: parseFloat(avgPrices[0].avg_midgrade).toFixed(3),
          premium: parseFloat(avgPrices[0].avg_premium).toFixed(3),
          diesel: parseFloat(avgPrices[0].avg_diesel).toFixed(3)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching database stats:', error);
    res.status(500).json({ error: 'Failed to fetch database stats' });
  }
});

/**
 * API endpoint for admin to refresh data for a specific ZIP code
 */
app.post('/api/admin/refresh/:zipCode', async (req, res) => {
  try {
    const zipCode = req.params.zipCode;
    const apiKey = req.headers['x-api-key'];
    
    // Simple API key check (in production, use a more secure method)
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Fetch fresh data from Barchart API
    const stationData = await getFuelPricesByZipCode(zipCode, 50);
    
    if (stationData && stationData.length > 0) {
      // Save to database
      const saved = await saveStationPriceData(stationData);
      
      if (saved) {
        res.json({ 
          success: true, 
          message: `Successfully refreshed data for ${zipCode}`, 
          stations: stationData.length 
        });
      } else {
        res.status(500).json({ error: 'Failed to save data to database' });
      }
    } else {
      res.status(404).json({ error: `No stations found for ZIP code ${zipCode}` });
    }
  } catch (error) {
    console.error(`Error refreshing data for ZIP code ${req.params.zipCode}:`, error);
    res.status(500).json({ error: `Failed to refresh data for ZIP code ${req.params.zipCode}` });
  }
});

/**
 * Scheduled task to refresh national data daily
 */
function scheduleDataRefresh() {
  console.log('Setting up scheduled data refresh...');
  
  const refreshInterval = 24 * 60 * 60 * 1000; // 24 hours
  
  setInterval(async () => {
    console.log('Running scheduled data refresh...');
    try {
      // Refresh national data
      const nationalData = await refreshNationalData();
      
      // Refresh key states
      const keyStates = ['CA', 'TX', 'NY', 'FL', 'IL', 'MD'];
      for (const state of keyStates) {
        await getFuelPricesByState(state);
      }
      
      console.log('Scheduled data refresh completed successfully');
    } catch (error) {
      console.error('Error in scheduled data refresh:', error);
    }
  }, refreshInterval);
  
  // Run immediately on startup
  setTimeout(async () => {
    try {
      console.log('Running initial data refresh...');
      await refreshNationalData();
      console.log('Initial data refresh completed');
    } catch (error) {
      console.error('Error in initial data refresh:', error);
    }
  }, 5000); // Wait 5 seconds after startup
}

/**
 * Helper function to refresh national data
 */
async function refreshNationalData() {
  // Use the existing national endpoint logic
  const regions = {
    'Northeast': ['NY', 'MA', 'CT', 'RI', 'VT', 'NH', 'ME', 'PA', 'NJ'],
    'Southeast': ['FL', 'GA', 'SC', 'NC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
    'Midwest': ['OH', 'MI', 'IN', 'IL', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
    'Southwest': ['TX', 'OK', 'NM', 'AZ'],
    'West': ['CA', 'NV', 'UT', 'CO', 'WY', 'MT', 'ID', 'WA', 'OR', 'AK', 'HI']
  };

  const sampleStates = {
    'Northeast': ['NY', 'MA', 'PA'],
    'Southeast': ['FL', 'GA', 'NC'],
    'Midwest': ['IL', 'OH', 'MI'],
    'Southwest': ['TX', 'AZ'],
    'West': ['CA', 'WA', 'CO']
  };

  const statePromises = [];
  const stateToRegion = {};

  for (const [region, states] of Object.entries(sampleStates)) {
    for (const state of states) {
      stateToRegion[state] = region;
      statePromises.push(getFuelPricesByState(state));
    }
  }

  const stateResults = await Promise.all(statePromises);

  const regionData = {
    'US': { regular: [], midgrade: [], premium: [], diesel: [] }
  };

  Object.keys(regions).forEach(region => {
    regionData[region] = { regular: [], midgrade: [], premium: [], diesel: [] };
  });

  stateResults.forEach((stateStations, index) => {
    if (!stateStations || stateStations.length === 0) return;

    const state = stateStations[0].state;
    const region = stateToRegion[state] || 'US';

    stateStations.forEach(station => {
      station.regular = findPriceByType(station.prices, "Regular Gas");
      station.midgrade = findPriceByType(station.prices, "Midgrade Gas");
      station.premium = findPriceByType(station.prices, "Premium Gas");
      station.diesel = findPriceByType(station.prices, "Diesel");

      if (station.regular) {
        regionData[region].regular.push(parseFloat(station.regular));
        regionData['US'].regular.push(parseFloat(station.regular));
      }
      if (station.midgrade) {
        regionData[region].midgrade.push(parseFloat(station.midgrade));
        regionData['US'].midgrade.push(parseFloat(station.midgrade));
      }
      if (station.premium) {
        regionData[region].premium.push(parseFloat(station.premium));
        regionData['US'].premium.push(parseFloat(station.premium));
      }
      if (station.diesel) {
        regionData[region].diesel.push(parseFloat(station.diesel));
        regionData['US'].diesel.push(parseFloat(station.diesel));
      }
    });
  });

  const calculateAverage = arr => 
    arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3) : null;

  const nationalData = {
    regular: {},
    midgrade: {},
    premium: {},
    diesel: {},
    latestDate: {
      regular: new Date().toISOString().split('T')[0],
      midgrade: new Date().toISOString().split('T')[0],
      premium: new Date().toISOString().split('T')[0],
      diesel: new Date().toISOString().split('T')[0]
    }
  };

  Object.entries(regionData).forEach(([region, prices]) => {
    nationalData.regular[region] = calculateAverage(prices.regular);
    nationalData.midgrade[region] = calculateAverage(prices.midgrade);
    nationalData.premium[region] = calculateAverage(prices.premium);
    nationalData.diesel[region] = calculateAverage(prices.diesel);
  });

  await saveNationalPriceData(nationalData);
  return nationalData;
}

// Initialize the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  try {
    // Test the database connection
    const connection = await pool.getConnection();
    console.log('Database connection successful!');
    connection.release();
    
    // Test database insertion function
    await testDatabaseInsertion();
    
    // Start scheduled data refreshes
    scheduleDataRefresh();
  } catch (error) {
    console.error('Error initializing server:', error);
    process.exit(1); // Exit if database connection fails
  }
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  try {
    await pool.end();
    console.log('Database pool closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

module.exports = app;