// Ruta: api/football.js
module.exports = async (request, response) => {
  const apiKey = process.env.VITE_FOOTBALL_DATA_API_KEY;
  const path = decodeURIComponent(request.query.path);
  const apiUrl = `https://api.football-data.org/v4/${path}`;

  try {
    const fetch = (await import('node-fetch')).default;
    const apiResponse = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': apiKey },
    });

    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json({ message: 'Error en la API externa.' });
    }

    const data = await apiResponse.json();

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return response.status(200).json(data);

  } catch (error) {
    console.error("Error en la función serverless:", error);
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
};