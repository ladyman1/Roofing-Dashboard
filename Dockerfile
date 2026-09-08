FROM node:22-alpine

WORKDIR /app

# Install build dependencies for native modules if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
