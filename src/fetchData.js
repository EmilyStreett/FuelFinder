const mysql = require("mysql2/promise");
const fs = require("fs");

// Create a connection pool
const pool = mysql.createPool({
  host: "localhost:3306", 
  user: "e.g.streett@email.msmary.edu", // Change this
  password: "1j*Y*0205864B", // Change this
  database: "finalProject", // Change this
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Function to fetch gas station data
async function getGasStations() {
  try {
    const query = `
      SELECT 
        gs.id, gs.name, gs.brand, 
        l.address, l.city, l.state, l.zip_code,
        fp.fuel_type, fp.price
      FROM GasStations gs
      JOIN Locations l ON gs.location_id = l.id
      JOIN FuelPrices fp ON gs.id = fp.station_id
      ORDER BY fp.price ASC;  -- Sort by lowest price first
    `;

    const [rows] = await pool.query(query);
    console.log("Gas Stations:", rows);
    fs.writeFileSync("gasData.json", JSON.stringify(rows, null, 2))
}
    except{

}
}

// Run the function
getGasStations();
