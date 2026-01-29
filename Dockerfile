# Dockerfile

# ---- Builder Stage ----
# This stage compiles the TypeScript to JavaScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the TypeScript project
RUN npx tsc

# ---- Production Stage ----
# This stage creates the final, lean image for production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

# Copy the compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 3000

# The command to run the application
CMD ["node", "dist/index.js"]