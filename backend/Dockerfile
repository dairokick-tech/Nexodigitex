FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY server.js ./
COPY tenant-schema.sql ./
USER node
EXPOSE 8080
CMD ["node","server.js"]
