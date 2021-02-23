import { gql } from 'apollo-server-lambda';

const typeDefs = gql`
  type Query {
    appointments(date: String, barberID: ID): [Appointment]!
    appointment(appointmentID: ID!): Appointment!
    barbers(dateTime: String): [Barber]!
    barber(barberID: ID, email: String): Barber!
  }
  type Mutation {
    createAppointment(input: CreateAppointmentInput!): Appointment!
    createBarber(input: CreateBarberInput!): Barber!
    updateAppointment(appointmentID: ID!, input: UpdateAppointmentInput!): Appointment!
    updateBarber(barberID: ID!, input: UpdateBarberInput!): Barber!
  }
  type Barber {
    email: String!
    fullName: String!
    id: ID!
    profileImageURL: String!
    specialisation: Specialisation!
    appointments(date: String): [Appointment]!
  }
  type Appointment {
    duration: Int!
    email: String!
    fullName: String!
    id: ID!
    phoneNumber: String!
    serviceName: Service!
    time: String!
    barber: Barber!
  }
  input CreateAppointmentInput {
    duration: Int!
    email: String!
    name: Name!
    phoneNumber: String!
    serviceName: Service!
    time: String!
    barberID: ID!
  }
  input UpdateAppointmentInput {
    duration: Int
    email: String
    name: Name
    phoneNumber: String
    serviceName: Service
    time: String
    barberID: ID
  }
  input CreateBarberInput {
    email: String!
    name: Name!
    specialisation: Specialisation!
    password: String!
  }
  input UpdateBarberInput {
    email: String
    name: Name
    profileImageURL: String
    specialisation: Specialisation
  }
  input Name {
    first: String!
    last: String!
  }
  enum Specialisation {
    BEARDS
    HAIRCUTS
  }
  enum Service {
    HAIRCUT
    SHAVING
    COMBO
    FATHERSON
    JUNIOR
  }
`;

export default typeDefs;
