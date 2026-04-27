FROM node:20-bookworm
WORKDIR /repo
COPY api api
WORKDIR /repo/api
RUN npm install
EXPOSE 3001
CMD ["npm", "start"]
