#################### BASE STAGE ####################
# Base image
FROM --platform=linux/amd64 node:22.11.0 as base

# Create app directory
WORKDIR /app

RUN npm install -g pnpm@9.15.4

# Copy package manifests and pnpm config
COPY package.json pnpm-lock.yaml .npmrc ./

#################### DEVELOPMENT STAGE ####################

# Development stage
FROM base AS development

# Install app dependencies
RUN pnpm install --frozen-lockfile

# Bundle app source
COPY . .

# Creates a "dist" folder with the production build
RUN pnpm run build

# Expose the port on which the app will run
EXPOSE 3004

# Start the server using the production build
CMD ["pnpm", "run", "start"]

#################### BUILD STAGE ####################

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm prune --prod

#################### PRODUCTION STAGE ####################

# Base image
FROM --platform=linux/amd64 node:22.11.0 as production

# Create app directory
WORKDIR /app

# Copy the "dist" folder from the build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Expose the port on which the app will run
EXPOSE 3004

# Start the server using the production build
CMD ["node", "dist/main.js"]
