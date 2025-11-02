# Minimal Node image for the notifications server
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install only production dependencies from the root package.json
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code and (optionally) static folders
COPY server ./server
COPY public ./public
# If you build the site elsewhere (Netlify), dist may not exist; that's fine
# COPY dist ./dist

ENV NODE_ENV=production
# Fly uses 8080 by default; our server reads PORT
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server/index.js"]
