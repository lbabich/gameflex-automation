FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:dashboard

EXPOSE 3001

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
