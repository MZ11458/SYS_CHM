FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/tsconfig.json apps/backend/tsconfig.json
RUN npm ci --workspace apps/backend

COPY apps/backend apps/backend
RUN npm --workspace apps/backend run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --workspace apps/backend --omit=dev

COPY --from=build /app/apps/backend/dist /app/apps/backend/dist

EXPOSE 4000
CMD ["node", "/app/apps/backend/dist/index.js"]
