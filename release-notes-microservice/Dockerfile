# Use Node.js LTS version as base image
FROM node:20-slim

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