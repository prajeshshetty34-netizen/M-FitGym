FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Use PORT env var provided by Cloud Run; default to 3000
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
