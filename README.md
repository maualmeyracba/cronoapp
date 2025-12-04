# ⏱️ CronoApp: Sistema de Gestión y Programación Horaria

[![Estado del Proyecto](https://img.shields.io/badge/Estado-Desarrollo-blue.svg)](URL_del_Proyecto)
[![Tecnología Principal](https://img.shields.io/badge/Stack-Node.js%20%7C%20Firebase-green.svg)](URL_de_Firebase)

## Descripción del Proyecto

**CronoApp** es una aplicación modular de gestión de recursos diseñada para automatizar la programación de horarios, el seguimiento de la asistencia y la administración de datos de empleados y clientes.

La aplicación se compone de:

1.  **`apps/functions`**: El Backend, implementado con **TypeScript** y desplegado como **Cloud Functions para Firebase**. Contiene la lógica de negocio, incluyendo servicios de autenticación, gestión de datos (clientes, empleados, ausencias) y módulos de programación y auditoría.
2.  **`apps/web`**: El Frontend (aplicación web) que interactúa con las funciones del backend y sirve la interfaz de usuario.
3.  **Configuración Firebase**: Maneja el hosting, la base de datos (Firestore) y las funciones del servidor.

## 🛠️ Tecnologías Utilizadas

* **Backend**: Node.js, TypeScript
* **Servicios Cloud**: Firebase Cloud Functions, Firestore, Firebase Hosting, Authentication
* **Dependencias de Gestión**: (Menciona si usas NestJS, Express, o librerías clave de gestión de tiempo)

## 🚀 Instalación y Configuración Local

Sigue estos pasos para levantar el proyecto en tu entorno de desarrollo.

### 1. Requisitos Previos

* Node.js (versión LTS recomendada)
* npm o yarn (se recomienda usar `npm`)
* Firebase CLI (Instalación: `npm install -g firebase-tools`)

### 2. Clonar el Repositorio (Si es la primera vez)

Si tu proyecto ya está en GitHub:

```bash
git clone [https://github.com/maualmeyracba/cronoapp.gitO]
cd cronoapp