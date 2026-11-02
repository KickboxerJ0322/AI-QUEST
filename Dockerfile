FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package.json server.mjs agent.mjs runner.mjs navigation.mjs ./
RUN npm install --omit=dev --no-audit --no-fund
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
