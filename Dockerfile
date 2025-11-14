# Use official Apify SDK image as base
# This image includes Node.js, Chrome, and other necessary tools
FROM apify/actor-node:20

# Copy package files
COPY package*.json ./

# Clean install ALL dependencies (including devDependencies for TypeScript build)
# Using --include=dev to ensure devDependencies are installed
RUN npm ci --include=dev || npm install --include=dev

# Copy source code
COPY . ./

# Build TypeScript code
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# Set the command to run the actor
CMD node dist/main.js
