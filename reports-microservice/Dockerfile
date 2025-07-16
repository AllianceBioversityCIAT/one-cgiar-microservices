#################### BASE STAGE ####################
# Usar una versión específica y compatible de Node.js
FROM --platform=linux/amd64 node:23 AS base

# Crear el directorio de la app
WORKDIR /app

# Copiar los archivos de dependencias
COPY package*.json ./

#################### DEVELOPMENT STAGE ####################
FROM base AS development

# Instalar dependencias de desarrollo
RUN npm install

# Copiar todo el código fuente
COPY . .

# Compilar el proyecto
RUN npm run build

# Exponer el puerto para desarrollo
EXPOSE 3001

# Iniciar el servidor en desarrollo
CMD ["npm", "run", "start"]

#################### BUILD STAGE ####################
FROM base AS build

# Instalar solo las dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Compilar el proyecto
RUN npm run build

#################### PRODUCTION STAGE ####################
FROM --platform=linux/amd64 node:23 AS production

# Crear el directorio de la app
WORKDIR /app

# Copiar artefactos desde la etapa de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Exponer el puerto en producción
EXPOSE 3001

# Ejecutar el servidor en producción
CMD ["node", "dist/main.js"]
