FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV OMP_THREAD_LIMIT=1
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-por \
  && mkdir -p /app/storage/pdfs \
  && chown -R node:node /app
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 3333
CMD ["node", "src/server.js"]
