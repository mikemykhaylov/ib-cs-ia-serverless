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
import connectToDatabase from './utils/db';

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
      // Retrieving and validating ACCESS token
      const token = req.headers.Authorization.split(' ')[1] || '';
      const JWKS = createRemoteJWKSet(new URL(`${domain}/.well-known/jwks.json`));
      try {
        const { payload } = (await jwtVerify(token, JWKS, {
          issuer: `${domain}/`,
          audience: 'https://u06740719i.execute-api.eu-central-1.amazonaws.com/dev/graphql',
        })) as Auth0AuthToken;
        // If successful, we get MANAGEMENT token from Auth0 by Cyberpunk Barbershop Server app...
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

        // This API is accessible by both users and Machine to Machine connections
        // The difference between them is in the auditories
        // Users have an additional auditory : https://dev-q6a92igd.eu.auth0.com/userinfo
        // So if a machine is calling, we are not requesting the email for several reasons
        // 1) It is not a user, therefore doesn't have an email
        // 2) Has only permission to update barber (for now),so it wouldnt be able to access
        // private properties in the first place
        // If instead a user is making a request, we request his email from Auth0
        // Email is only used to protect private barber properties from other barbers
        let email = '';
        if (payload.aud?.includes('https://dev-q6a92igd.eu.auth0.com/userinfo')) {
          const response: { email: string } = await got
            .get(`${domain}/api/v2/users/${payload.sub}`, {
              headers: {
                authorization: `${managementToken.token_type} ${managementToken.access_token}`,
              },
              searchParams: {
                fields: 'email',
                include_fields: 'true',
              },
            })
            .json();
          email = response.email;
        }
        return {
          managementToken,
          user: {
            email,
            permissions: payload.permissions,
            id: payload.sub,
          },
          domain,
        };
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
