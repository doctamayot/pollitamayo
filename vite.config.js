import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Usaremos '/api' como un prefijo para nuestras peticiones
      '/api': {
        // La URL real a la que queremos apuntar
        target: 'https://api.football-data.org/v4',
        // Necesario para que el servidor de la API acepte la petición
        changeOrigin: true,
        // Reescribe la petición para quitar el prefijo '/api'
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  
})

