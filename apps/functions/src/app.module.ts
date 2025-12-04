// apps/functions/src/app.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { DataManagementModule } from './data-management/data-management.module'; // Importar nuevo módulo

@Module({
  imports: [
    AuthModule,
    SchedulingModule,
    DataManagementModule, // Incluir el módulo de gestión de datos
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}