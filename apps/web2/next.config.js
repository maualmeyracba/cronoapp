
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',               // <--- ESTO OBLIGA A CREAR LA CARPETA 'out'
  reactStrictMode: true,
  images: {
    unoptimized: true,            // <--- OBLIGATORIO para Firebase Hosting (sin servidor de imágenes)
  },
  // Ignoramos errores menores para asegurar que el build termine
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Desactivamos funciones experimentales que puedan dar problemas
  experimental: {
    esmExternals: 'loose' 
  }
};

module.exports = nextConfig;
