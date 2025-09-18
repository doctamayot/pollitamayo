// Este código se ejecuta en el servidor de tu hosting (Vercel, Netlify, etc.)

export default async function handler(request, response) {
  // Obtenemos la clave de API de las variables de entorno del servidor
  //const apiKey = process.env.VITE_FOOTBALL_DATA_API_KEY;
  const apiKey = "a877c967a8d74f37859fe8d7e52cbfc1"
  
  // Obtenemos la parte de la URL que necesitamos (ej: 'competitions', 'matches?ids=123')
  // desde los parámetros de la petición.
  const path = request.query.path;

  // Construimos la URL final de la API real
  const apiUrl = `https://api.football-data.org/v4/${path}`;

  try {
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': apiKey,
      },
    });

    if (!apiResponse.ok) {
      // Si la API externa da un error, lo pasamos a nuestro frontend
      return response.status(apiResponse.status).json({ message: 'Error en la API externa.' });
    }

    const data = await await apiResponse.json();

    // Permitimos que nuestro dominio acceda a esta función
    response.setHeader('Access-Control-Allow-Origin', 'https://hugotamayo.com');
    // Configuramos la caché para que la respuesta se guarde por 1 hora en el servidor
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    
    // Enviamos los datos de vuelta a nuestra aplicación
    return response.status(200).json(data);

  } catch (error) {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}