FROM node:12-alpine

USER node
RUN mkdir -p /home/node/code
WORKDIR /home/node/code

COPY package*.json ./
RUN npm ci --ignore-scripts

ADD . .
