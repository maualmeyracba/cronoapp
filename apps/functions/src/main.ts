import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplicationContext } from '@nestjs/common';

/**
 * Crea el contexto de la aplicación NestJS sin levantar un servidor HTTP.
 * Esto es estrictamente lo que Cloud Functions necesita para poder inyectar servicios
 * como EmployeeService o AbsenceService dentro de las funciones 'onCall'.
 */
export const createNestApp = async (): Promise<INestApplicationContext> => {
  // 🛑 USAMOS createApplicationContext EN LUGAR DE create()
  // Esto inicia el motor de NestJS pero no ocupa puertos ni sockets.
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Si tienes inicializaciones globales (como validadores), van aquí.
  // Pero NUNCA llames a app.listen() en este archivo para Cloud Functions.
  
  return app;
};