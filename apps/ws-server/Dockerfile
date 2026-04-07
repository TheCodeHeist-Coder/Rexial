FROM node:22-alpine

RUN npm i -g pnpm


# set working directory at repo root
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

COPY apps ./apps

COPY packages ./packages


RUN pnpm install

# move to frontend app
WORKDIR /app/apps/ws-server

EXPOSE 8080

CMD [ "pnpm", "run", "start" ]