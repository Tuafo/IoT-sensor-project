FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV VITE_API_BASE_URL=http://localhost:8001

EXPOSE 5174

CMD ["npm", "run", "dev"]
