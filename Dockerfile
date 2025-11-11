# Use official Apify SDK image as base
# This image includes Node.js, Chrome, and other necessary tools
FROM apify/actor-node:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --omit=optional

# Copy source code
COPY . ./

# Build TypeScript code
RUN npm run build

# Set the command to run the actor
CMD npm start
