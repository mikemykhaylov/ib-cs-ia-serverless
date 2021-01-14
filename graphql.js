/* eslint-disable no-param-reassign */
require('dotenv').config({ path: './variables.env' });
const { ApolloServer } = require('apollo-server-lambda');

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
});
const graphqlHandler = server.createHandler({
  cors: {
    origin: true,
    credentials: true,
  },
});
const handler = middy(graphqlHandler).use(middleware);

exports.graphqlHandler = handler;
