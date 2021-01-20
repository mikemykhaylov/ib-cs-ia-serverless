import mongoose from 'mongoose';
let isConnected: boolean;

export default async () => {
  if (isConnected) {
    // We already have the connection from the previous request
    return Promise.resolve();
  }
  // We have to connect to the DB
  const dbAdress = process.env.DB || `${process.env.LOCALDB}ib-comp-sci-ia`;
  const db = await mongoose.connect(dbAdress, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  });
  isConnected = !!db.connections[0].readyState;
  return Promise.resolve();
};
