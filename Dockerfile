# Build stage
FROM node:20-slim AS builder

# Install SQLite dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim

# Install SQLite dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY server.js .
COPY src/lib/serverLogger.js ./src/lib/serverLogger.js

# Create directories for database and logs
RUN mkdir -p db logs

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Create volume for persistent data
VOLUME ["/app/db", "/app/logs"]

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
