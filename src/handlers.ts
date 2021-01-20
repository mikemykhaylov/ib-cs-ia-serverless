/* eslint-disable import/no-unresolved */
import middy from '@middy/core';
import { ApolloServer } from 'apollo-server-lambda';
import got from 'got';
import createRemoteJWKSet from 'jose/jwks/remote';
import jwtVerify from 'jose/jwt/verify';

import MongodbAPI from './apollo/mongodbAPI';
import resolvers from './apollo/resolvers';
import typeDefs from './apollo/typeDefs';
import connectToDatabase from './db';

// Generic type for middy middleware for AWS Lambda
type AWSMiddleware<T> = {
  before: (handler: { context: AWSLambda.Context }) => Promise<T>;
};

const middleware: AWSMiddleware<void> = {
  before: async ({ context }) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connectToDatabase();
    return Promise.resolve();
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    mongodbAPI: new MongodbAPI(),
  }),
  context: async ({ event: req }) => {
    if (req.headers.Authorization) {
      const token = req.headers.Authorization.split(' ')[1] || '';
      const JWKS = createRemoteJWKSet(
        new URL('https://dev-q6a92igd.eu.auth0.com/.well-known/jwks.json'),
      );
      try {
        const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
          issuer: 'https://dev-q6a92igd.eu.auth0.com/',
          audience: 'https://u06740719i.execute-api.eu-central-1.amazonaws.com/dev/graphql',
        });
        const { body } = await got.post('https://dev-q6a92igd.eu.auth0.com/oauth/token', {
          json: {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            audience: 'https://dev-q6a92igd.eu.auth0.com/api/v2/',
            grant_type: 'client_credentials',
          },
        });
        console.log(body);
        return { payload, protectedHeader };
      } catch (err) {
        return {};
      }
    }
    return {};
  },
});
const graphql = middy(
  server.createHandler({
    cors: {
      origin: true,
      credentials: true,
    },
  }),
).use(middleware);

export { graphql };
