FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 기본 실행: HTTP 서버 모드 (Cloud Run에서 /run POST 시 모니터 실행)
CMD ["npm", "run", "serve"]
