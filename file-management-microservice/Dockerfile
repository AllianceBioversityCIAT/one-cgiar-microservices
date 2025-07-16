#################### BASE STAGE ####################
# Usar una versión estable y compatible de Node.js
FROM --platform=linux/amd64 node:18 AS base

# Crear el directorio de la app
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

#################### DEVELOPMENT STAGE ####################
FROM base AS development

# Instalar dependencias para desarrollo
RUN npm install

# Copiar todo el código fuente
COPY . .

# Construir la aplicación (compilar TypeScript, etc.)
RUN npm run build

# Exponer el puerto en desarrollo
EXPOSE 3000

# Comando de inicio para desarrollo
CMD ["npm", "run", "start"]

#################### BUILD STAGE ####################
FROM base AS build

# Instalar solo dependencias de producción
RUN npm ci --only=production

# Copiar todo el código fuente
COPY . .

# Construir la aplicación para producción
RUN npm run build

#################### PRODUCTION STAGE ####################
FROM --platform=linux/amd64 node:18 AS production

# Crear el directorio de la app
WORKDIR /app

# Copiar archivos necesarios desde el stage de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Exponer el puerto que usa la app
EXPOSE 3000

# Comando para ejecutar en producción
CMD ["node", "dist/main.js"]
