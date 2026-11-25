# Imagem OPCIONAL da aplicação web (o modo recomendado é "npm start" no Windows).
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
