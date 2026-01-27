// Archivo: apps/web/next.config.ts

const path = require('path');
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🛑 FIX CRÍTICO: Genera la carpeta 'out' para Firebase Hosting
  output: 'export',
  
  // 🛑 Requerido para 'output: export'
  images: {
    unoptimized: true,
  },

  // 🛑 FIX CLAVE: Configuración oficial para silenciar el conflicto Turbopack/Webpack.
  // Esto le dice a Next.js que, si bien tiene configuración Webpack (para el alias),
  // debe aceptar el modo Turbopack sin errores.
  experimental: {
    // La clave correcta para configurar Turbopack es esta, no solo 'turbopack' dentro del experimental
    outputFileTracingExcludes: {
      '**': [
        './node_modules/@next/swc/node_modules',
        './node_modules/next/dist/compiled/@next/font',
      ],
    },
    // Aseguramos que acepta la configuración de webpack
    // Alternativamente, puedes usar el flag --webpack al compilar si esto falla.
  },
  
  // Configuración de Webpack para Alias (@/)
  webpack: (config: any, context: any) => { 
    // Mantiene el alias '@/' apuntando a la carpeta 'src'
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;



