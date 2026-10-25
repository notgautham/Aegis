FROM node:22-alpine
# Security patches for Alpine and the bundled npm CLI
RUN apk upgrade --no-cache && npm install -g npm@11 && npm cache clean --force
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "run", "preview", "--", "--port", "8080", "--host", "0.0.0.0"]
