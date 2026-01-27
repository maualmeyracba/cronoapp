// jest.config.js en apps/web/

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    // 🛑 CRÍTICO: Mapear el alias @/ a la carpeta src/
    '^@/(.*)$': '<rootDir>/src/$1', 
    // Mapear archivos CSS y estáticos para Jest
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'], // Archivo para importar @testing-library/jest-dom
};



