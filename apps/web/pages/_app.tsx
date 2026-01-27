import React from 'react';
import type { AppProps } from 'next/app';
// 1. Importamos el sistema de notificaciones (Frontend)
import { Toaster } from 'react-hot-toast';
// 2. Importamos el proveedor de contexto de cliente (Frontend)
import { ClientProvider } from '@/context/ClientContext';
// 3. Importamos los estilos globales (Tailwind)
import '@/styles/globals.css'; 

export default function App({ Component, pageProps }: AppProps) {
  return (
    // Envolvemos toda la app en el ClientProvider para tener acceso a la empresa seleccionada
    <ClientProvider>
      
      {/* Renderizamos la página actual */}
      <Component {...pageProps} />
      
      {/* Configuración global de las notificaciones (Toasts) */}
      <Toaster 
        position="top-right" 
        reverseOrder={false}
        toastOptions={{
          // Estilos por defecto para todas las notificaciones
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
            fontSize: '14px',
          },
          // Estilos específicos para éxito (Verde)
          success: {
            style: {
              background: '#ECFDF5', // Verde muy claro
              color: '#065F46',      // Texto verde oscuro
              border: '1px solid #10B981',
            },
            iconTheme: {
              primary: '#10B981',
              secondary: '#FFFAEE',
            },
          },
          // Estilos específicos para error (Rojo)
          error: {
            style: {
              background: '#FEF2F2', // Rojo muy claro
              color: '#991B1B',      // Texto rojo oscuro
              border: '1px solid #EF4444',
            },
            duration: 5000, // Duran 5 segundos para poder leerlos bien
          },
        }}
      />
    </ClientProvider>
  );
}



