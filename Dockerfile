FROM node:20-alpine
WORKDIR /usr/src/app

# Install dependencies (package.json may be updated later)
COPY package.json package-lock.json* ./
RUN npm set progress=false && npm config set depth 0 || true
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm i --omit=dev; fi || true

COPY . .

EXPOSE 3000
CMD ["node", "./src/api/index.js"]
