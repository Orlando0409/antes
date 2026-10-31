# UNA Chat en Node.js (misma version que .nvmrc)
FROM node:26-alpine

WORKDIR /app
ENV NODE_ENV=production

# solo dependencias de produccion, con el lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js index.html ./
COPY libs ./libs

USER node
EXPOSE 3000

# comando de inicio del proyecto
CMD ["npm", "start"]
