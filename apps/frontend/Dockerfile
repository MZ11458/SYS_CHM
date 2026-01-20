FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace apps/frontend

COPY apps/frontend apps/frontend
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm --workspace apps/frontend run build

FROM nginx:alpine
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
