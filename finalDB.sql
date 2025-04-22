#creating database where the data for project will live through the api/webscraping

CREATE database finalProject;
USE finalProject;
#DROP TABLE IF EXISTS Locations;

CREATE TABLE Locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    country VARCHAR(50) DEFAULT 'USA'
);

CREATE TABLE GasStations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100),
    location_id INT NOT NULL,
    phone_number VARCHAR(20),
    google_maps_id VARCHAR(255),  -- Stores unique Google Maps reference ID
    FOREIGN KEY (location_id) REFERENCES Locations(id)
);

CREATE TABLE FuelPrices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    fuel_type VARCHAR(50) NOT NULL, -- e.g., Regular, Mid-grade, Premium, Diesel
    price DECIMAL(5, 2) NOT NULL,
    price_date TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (station_id) REFERENCES GasStations(id) ON DELETE CASCADE
);

CREATE TABLE Reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    review_text TEXT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    review_date TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (station_id) REFERENCES GasStations(id) ON DELETE CASCADE
);
