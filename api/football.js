// Este código se ejecuta en el servidor de tu hosting (Vercel, etc.)
// y usa la función fetch que ya está disponible en ese entorno.
module.exports = async (request, response) => {
  const apiKey = process.env.VITE_FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    console.error("La variable de entorno VITE_FOOTBALL_DATA_API_KEY no está definida en el servidor.");
    return response.status(500).json({ 
      message: 'Error de configuración del servidor: La clave de API no está configurada.' 
    });
  }
  
  const path = decodeURIComponent(request.query.path);
  const apiUrl = `https://api.football-data.org/v4/${path}`;

  try {
    const apiResponse = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': apiKey },
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error(`Error de la API externa (${apiResponse.status}):`, errorBody);
      return response.status(apiResponse.status).json({ message: `Error en la API externa: ${apiResponse.statusText}` });
    }

    const data = await apiResponse.json();
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    
    return response.status(200).json(data);

  } catch (error) {
    console.error("Error en la función serverless:", error);
    return response.status(500).json({ message: 'Error interno del servidor al procesar la petición.' });
  }
};