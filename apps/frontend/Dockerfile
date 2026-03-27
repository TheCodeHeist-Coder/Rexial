FROM node:20-alpine

RUN npm i -g pnpm

WORKDIR /app

# Copy root config (IMPORTANT for turborepo)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./


COPY apps ./apps
COPY packages ./packages


RUN pnpm install

# Move to frontend app
WORKDIR /app/apps/frontend


EXPOSE 5173

CMD [ "pnpm", "run", "dev" ]