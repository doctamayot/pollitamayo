// api/worldcup.cjs
const axios = require('axios'); // Asumo que usas axios como en los otros, si usas node-fetch cámbialo.

module.exports = async (req, res) => {
    // Configuración de cabeceras CORS para permitir la conexión con tu frontend
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Manejo del preflight de CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Llamada a la API oficial desde el servidor (donde no hay CORS)
        const response = await axios.get('https://api.football-data.org/v4/competitions/WC/matches', {
            headers: {
                'X-Auth-Token': process.env.VITE_FOOTBALL_DATA_API_KEY // Tu variable de entorno
            }
        });

        // Enviamos la data al frontend
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error fetching World Cup matches:', error?.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: 'Error al comunicarse con la API de fútbol',
            details: error?.response?.data 
        });
    }
};