#################### BASE STAGE ####################
# Use a stable and compatible version of Node.js
FROM --platform=linux/amd64 node:23 AS base

# Create the app directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

#################### DEVELOPMENT STAGE ####################
FROM base AS development

# Install development dependencies
RUN npm install

# Copy all source code
COPY . .

# Build the application (compile TypeScript, etc.)
RUN npm run build

# Expose the port in development
EXPOSE 3000

# Startup command for development
CMD ["npm", "run", "start"]

#################### BUILD STAGE ####################
FROM base AS build

# Install only production dependencies
RUN npm ci --only=production

# Copy all source code
COPY . .

# Build the application for production
RUN npm run build

#################### PRODUCTION STAGE ####################
FROM --platform=linux/amd64 node:23 AS production

# Create the app directory
WORKDIR /app

# Copy necessary files from the build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Expose the port used by the app
EXPOSE 3000

# Command to run in production
CMD ["node", "dist/main.js"]
