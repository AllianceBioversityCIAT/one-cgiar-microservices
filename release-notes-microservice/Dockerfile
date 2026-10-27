# Use Node.js LTS version as base image
FROM node:22.23.4-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Expose port (assuming default Express port 3000)
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 