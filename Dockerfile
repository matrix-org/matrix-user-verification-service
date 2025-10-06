FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY . .

ENV UVS_LISTEN_ADDRESS=0.0.0.0

EXPOSE 3000

CMD ["node", "src/app.js"]
