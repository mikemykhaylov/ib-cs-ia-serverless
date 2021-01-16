/* eslint-disable no-param-reassign */
require('dotenv').config({ path: './variables.env' });
const { ApolloServer } = require('apollo-server-lambda');
const { default: jwtVerify } = require('jose/jwt/verify');
const { default: createRemoteJWKSet } = require('jose/jwks/remote');

const middy = require('@middy/core');
const connectToDatabase = require('./db');

const typeDefs = require('./apollo/typeDefs');
const resolvers = require('./apollo/resolvers');
const MongodbAPI = require('./apollo/mongodbAPI');

const middleware = {
  before: async (handler) => {
    handler.context.callbackWaitsForEmptyEventLoop = false;
    await connectToDatabase();
    return Promise.resolve();
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    mongodbAPI: MongodbAPI,
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
        return { payload, protectedHeader };
      } catch (err) {
        return {};
      }
    }
    return {};
  },
});
const graphqlHandler = server.createHandler({
  cors: {
    origin: true,
    credentials: true,
  },
});
const handler = middy(graphqlHandler).use(middleware);

exports.graphqlHandler = handler;
