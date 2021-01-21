/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-unresolved */
import middy from '@middy/core';
import { ApolloServer } from 'apollo-server-lambda';
import got from 'got';
import createRemoteJWKSet from 'jose/jwks/remote';
import jwtVerify, { JWTPayload } from 'jose/jwt/verify';
import { JWTVerifyResult } from 'jose/webcrypto/types';

import MongodbAPI from './apollo/mongodbAPI';
import resolvers from './apollo/resolvers';
import typeDefs from './apollo/typeDefs';
import connectToDatabase from './db';

// Generic type for middy middleware for AWS Lambda
type AWSMiddleware<T> = {
  before: (handler: { context: AWSLambda.Context }) => Promise<T>;
};
export interface Auth0ManagementToken {
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
}

interface Auth0AuthToken extends JWTVerifyResult {
  payload: Auth0AuthTokenPayload;
}

interface Auth0AuthTokenPayload extends JWTPayload {
  azp: string;
  scope: string;
  permissions: string[];
}

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
  context: async ({ event: req }: { event: AWSLambda.APIGatewayProxyEventV2 }) => {
    if (req.headers.Authorization) {
      const domain = 'https://dev-q6a92igd.eu.auth0.com';
      const token = req.headers.Authorization.split(' ')[1] || '';
      const JWKS = createRemoteJWKSet(new URL(`${domain}/.well-known/jwks.json`));
      try {
        const { payload } = (await jwtVerify(token, JWKS, {
          issuer: `${domain}/`,
          audience: 'https://u06740719i.execute-api.eu-central-1.amazonaws.com/dev/graphql',
        })) as Auth0AuthToken;
        const managementToken: Auth0ManagementToken = await got
          .post('https://dev-q6a92igd.eu.auth0.com/oauth/token', {
            json: {
              client_id: process.env.CLIENT_ID,
              client_secret: process.env.CLIENT_SECRET,
              audience: `${domain}/api/v2/`,
              grant_type: 'client_credentials',
            },
          })
          .json();
        const user: { email: string } = await got
          .get(
            `${domain}/api/v2/users/${encodeURI(payload.sub!)}?fields=email&include_fields=true`,
            {
              headers: {
                authorization: `${managementToken.token_type} ${managementToken.access_token}`,
              },
            },
          )
          .json();
        return { managementToken, user, permissions: payload.permissions };
      } catch (err) {
        console.log(err);
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
