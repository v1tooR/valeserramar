FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir /app/media && chown node:node /app/media
COPY src ./src
COPY sql ./sql
USER node
CMD ["node", "src/index.js"]
