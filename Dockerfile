## Stage 1: (production base)
FROM node:14.15.0-alpine AS base
# Information about this Docker image
LABEL org.opencontainers.image.authors=ch.benard[at]gmail.com
LABEL org.opencontainers.image.title="Resorption Bidonvilles API Docker Images"
LABEL org.opencontainers.image.licenses=MIT
EXPOSE $API_CONTAINER_PORT
# Defining the environment (dev, staging, prod, test)
ENV NODE_ENV=production
# Create the app directory
WORKDIR /home/node/rb/api
COPY . .

## Stage 2: (builddev)
FROM base as builddev
ENV NODE_ENV=development
ENV PATH=/home/node/rb/api/node_modules/.bin:$PATH
# Copy the files holding various metadata relevant to the project
COPY package.json yarn.lock ./
RUN yarn config list && yarn install --developement

# Stage 3: (dev)
FROM builddev as dev
CMD ["nodemon", "server/index.js", "--inspect=0.0.0.0:9229"]

## Stage 4: (test)
FROM builddev as test
RUN echo "Skipping test for the moment..."
# Pour qu'on ait à la fois les dépendances de dev et de prod:
# COPY --from=dev /home/node/rb/api/node_modules /home/node/rb/api/node_modules
# RUN eslint .
# RUN yarn test
# RUN yarn test:unit
# RUN yarn audit

## Stage 5: (buildproduction)
FROM base as prepaprod
# Install project external dependencies and clean cache 
# yarn install --frozen-lockfile is the closest yarn alternative to npm -ci
RUN yarn config list && yarn install --production --frozen-lockfile --silent && yarn cache clean
# Suppress the test directory not reqired in production
RUN rm -rf ./test

## Stage 6: (production)
FROM prepaprod as prod
RUN apk add --no-cache tini
RUN pwd && ls -l
RUN apk add gettext libintl && apk add --no-cache 'su-exec>=0.2'
COPY rb-api-entrypoint.sh /usr/local/bin/
RUN ls -l /usr/local/bin
ENTRYPOINT ["tini", "--", "/usr/local/bin/rb-api-entrypoint.sh"]
CMD ["node", "server/index.js"]