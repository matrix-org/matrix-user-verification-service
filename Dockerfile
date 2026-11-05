FROM node:22-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY . .

ENV UVS_LISTEN_ADDRESS=0.0.0.0

EXPOSE 3000

CMD ["node", "--use-openssl-ca", "src/app.js"]
