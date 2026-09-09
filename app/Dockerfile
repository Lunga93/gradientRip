# Syntax: docker build -t gradient-app ./app
# Run: docker run -p 3000:3000 gradient-app

FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/static ./static
EXPOSE 3000
CMD ["node", "build/index.js"]