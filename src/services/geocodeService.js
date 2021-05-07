const axios = require('axios');
const ngeohash = require('ngeohash');
const secretsManagerService = require('./secretsManagerService');
const GEOCODE_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

async function geocodeAddress(address) {
  const { geocodeApiKey } = await secretsManagerService.getSecrets();
  const { data } = await axios.get(GEOCODE_BASE_URL, {
    params: {
      address,
      key: geocodeApiKey,
    },
  });
  const { lat: latitude, lng: longitude } = data.results[0].geometry.location;
  return {
    latitude,
    longitude,
    geohash: ngeohash.encode(latitude, longitude),
  };
}

module.exports = {
  geocodeAddress,
};
