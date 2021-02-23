import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AuthenticationError, IResolvers } from 'apollo-server-lambda';
import got from 'got';
import { Auth0ManagementToken } from '../handlers';
import { AppointmentDocumentObject } from '../models/Appointment';
import { BarberDocument, BarberDocumentPopulated } from '../models/Barber';
import { bucketName, s3Client } from '../utils/awsSetup';
import MongodbAPI, {
  CreateAppointmentGraphQLApiInput,
  CreateBarberGraphQLApiInput,
  CreateBarberMongoApiInput,
  GetAppointmentGraphQLApiInput,
  GetAppointmentsGraphQLApiInput,
  GetBarberGraphQLApiInput,
  GetBarbersGraphQLApiInput,
  UpdateAppointmentGraphQLApiInput,
  UpdateBarberGraphQLApiInput,
} from './mongodbAPI';

type Resolver<Parent, Args, Result> = (
  parent: Parent,
  args: Args,
  context: {
    dataSources: { mongodbAPI: MongodbAPI };
    user?: { email: string; id: string; permissions?: string[] };
    managementToken?: Auth0ManagementToken;
    domain?: string;
  },
) => Promise<Result>;

type GetSignedURLInput = {
  barberID: string;
  fileExtension: string;
};

interface Resolvers extends IResolvers {
  Query: {
    appointments: Resolver<undefined, GetAppointmentsGraphQLApiInput, AppointmentDocumentObject[]>;
    appointment: Resolver<
      undefined,
      GetAppointmentGraphQLApiInput,
      AppointmentDocumentObject | undefined
    >;
    barbers: Resolver<
      undefined,
      GetBarbersGraphQLApiInput,
      (BarberDocument | BarberDocumentPopulated)[]
    >;
    barber: Resolver<undefined, GetBarberGraphQLApiInput, BarberDocument | undefined>;
    getSignedURL: Resolver<undefined, GetSignedURLInput, string>;
  };
  Mutation: {
    createAppointment: Resolver<
      undefined,
      CreateAppointmentGraphQLApiInput,
      AppointmentDocumentObject
    >;
    createBarber: Resolver<undefined, CreateBarberGraphQLApiInput, BarberDocument>;
    updateAppointment: Resolver<
      undefined,
      UpdateAppointmentGraphQLApiInput,
      AppointmentDocumentObject
    >;
    updateBarber: Resolver<undefined, UpdateBarberGraphQLApiInput, BarberDocument>;
  };
  Appointment: {
    barber: Resolver<AppointmentDocumentObject, null, BarberDocument>;
    fullName: Resolver<AppointmentDocumentObject, null, string>;
    email: Resolver<AppointmentDocumentObject, null, string>;
    phoneNumber: Resolver<AppointmentDocumentObject, null, string>;
    time(parent: AppointmentDocumentObject): string;
  };
  Barber: {
    appointments: Resolver<BarberDocument, { date: string }, AppointmentDocumentObject[]>;
    email: Resolver<BarberDocument, null, string>;
  };
}

const protectedAppointmentProperty: (
  property: 'email' | 'fullName' | 'phoneNumber',
) => Resolver<AppointmentDocumentObject, null, string> = (property) => {
  return async (parent, _, { dataSources, user }) => {
    if (user?.permissions?.includes('read:appointments_data')) {
      const assignedBarber = (await dataSources.mongodbAPI.getBarber({
        email: user.email,
      })) as BarberDocument;
      if (user.email === assignedBarber.email) {
        return parent[property];
      }
    }
    throw new AuthenticationError('Unauthorized');
  };
};

const resolvers: Resolvers = {
  Query: {
    // Used for:
    // 1) Listing all appointments (all barbers, all dates) (dev use)
    // 2) Listing all appointments of specific barber for a day (used in SelectTime when barber-first)
    appointments: async (_, args, { dataSources }) => {
      const foundAppointments = await dataSources.mongodbAPI.getAppointments(args);
      return foundAppointments;
    },
    // Used for:
    // 1) Finding an appointment by ID (dev use)
    appointment: async (_, args, { dataSources }) => {
      const foundAppointment = await dataSources.mongodbAPI.getAppointment(args);
      return foundAppointment;
    },
    // Used for:
    // 1) Listing all barbers (used in SelectBarber when barber-first)
    // 2) Listing all free barbers for a date and time (used in SelectBarber when time-first)
    barbers: async (_, args, { dataSources }) => {
      const foundBarbers = await dataSources.mongodbAPI.getBarbers(args);
      return foundBarbers;
    },
    // Used for:
    // 1) Finding a barber by ID (dev use)
    // 2) Finding a barber by email (used in Dashboard)
    barber: async (_, args, { dataSources }) => {
      const foundBarber = await dataSources.mongodbAPI.getBarber(args);
      return foundBarber;
    },
    getSignedURL: async (_, args, { user }) => {
      if (user?.permissions?.includes('create:barber')) {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: `barberProfileImages/${args.barberID}.${args.fileExtension}`,
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return url;
      }
      throw new AuthenticationError('Unauthorized');
    },
  },
  Mutation: {
    // Used for:
    // 1) Creating an appointment (used in GetDetails)
    createAppointment: async (_, args, { dataSources }) => {
      const createdAppointment = await dataSources.mongodbAPI.createAppointment(args);
      return createdAppointment;
    },
    // Used for:
    // 1) Creating a barber (used in Admin)
    createBarber: async (_, args, { dataSources, managementToken, user, domain }) => {
      if (user?.permissions?.includes('create:barber') && managementToken && domain) {
        const { email, name, specialisation } = args.input;
        const { user_id: auth0BarberId, picture }: { user_id: string; picture: string } = await got
          .post(encodeURI(`${domain}/api/v2/users`), {
            json: {
              connection: 'Username-Password-Authentication',
              email: args.input.email,
              password: args.input.password,
              name: `${args.input.name.first} ${args.input.name.last}`,
            },
            headers: {
              authorization: `${managementToken.token_type} ${managementToken.access_token}`,
            },
          })
          .json();
        await got.post(encodeURI(`${domain}/api/v2/roles/rol_5UrTEi3vDUKxTh8L/users`), {
          json: {
            users: [auth0BarberId],
          },
          headers: {
            authorization: `${managementToken.token_type} ${managementToken.access_token}`,
          },
        });
        const createBarberMongoArgs: CreateBarberMongoApiInput = {
          input: {
            email,
            name,
            specialisation,
            profileImageURL: picture,
          },
        };
        const createdBarber = await dataSources.mongodbAPI.createBarber(createBarberMongoArgs);
        return createdBarber;
      }
      throw new AuthenticationError('Unauthorized');
    },
    // Used for:
    // 1) Updating an appointment (dev use)
    updateAppointment: async (_, args, { dataSources }) => {
      const updatedAppointment = await dataSources.mongodbAPI.updateAppointment(args);
      return updatedAppointment;
    },
    // Used for:
    // 1) Updating a barber (dev use)
    updateBarber: async (_, args, { dataSources, managementToken, user, domain }) => {
      // Checking if:
      // 1) Logged in barber has permissions to update barbers (admin or image upload handler)
      // 2) Management token is present (formality)
      if (user?.permissions?.includes('update:barber') && managementToken && domain) {
        // First we update the barber in MongoDB, to retrieve his email
        const updatedBarber = await dataSources.mongodbAPI.updateBarber(args);

        // Then we retrieve the Auth0 barber id, because the user.id from context
        // is either the admin id or image upload handler id
        const [{ user_id }]: [{ user_id: string }] = await got
          .get(encodeURI(`${domain}/api/v2/users-by-email`), {
            searchParams: {
              email: updatedBarber.email,
              fields: 'user_id',
              include: 'true',
            },
            headers: {
              authorization: `${managementToken.token_type} ${managementToken.access_token}`,
            },
          })
          .json();

        // Then we construct the Auth0 update object
        const auth0UpdateObject: { name?: string; picture?: string } = {};
        if (args.input.name) {
          auth0UpdateObject.name = `${args.input.name?.first} ${args.input.name?.last}`;
        }
        if (args.input.profileImageURL) {
          auth0UpdateObject.picture = args.input.profileImageURL;
        }

        // And update the user with it
        await got.patch(encodeURI(`${domain}/api/v2/users/${user_id}`), {
          json: auth0UpdateObject,
          headers: {
            authorization: `${managementToken.token_type} ${managementToken.access_token}`,
          },
        });
        return updatedBarber;
      }
      throw new AuthenticationError('Unauthorized');
    },
  },
  Appointment: {
    // Used for:
    // 1) Getting a barber from appointment's barberID (dev use)
    barber: async (parent, _, { dataSources }) => {
      const foundBarber = (await dataSources.mongodbAPI.getBarber({
        barberID: parent.barberID.toHexString(),
      })) as BarberDocument;
      return foundBarber;
    },

    // Protected properties
    fullName: protectedAppointmentProperty('fullName'),
    email: protectedAppointmentProperty('email'),
    phoneNumber: protectedAppointmentProperty('phoneNumber'),
    time: (parent) => parent.time.toISOString(),
  },
  Barber: {
    // Used for:
    // 1) Listing all appointments of specific barber for date from barber's appointmentIDS (used in Dashboard)
    appointments: async (parent, args, { dataSources }) => {
      const foundAppointmentsPromises = parent.appointmentIDS.map((appointmentID) => {
        return dataSources.mongodbAPI.getAppointment({
          appointmentID: appointmentID.toHexString(),
        });
      });
      const foundAppointments = (await Promise.all(
        foundAppointmentsPromises,
      )) as AppointmentDocumentObject[];

      // Checking if args is an empty object
      if (Object.keys(args).length === 0 && args.constructor === Object) {
        // Returning all appointments sorted by date ASC
        return foundAppointments.sort(function (a, b) {
          return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
        });
      }

      const foundAppointmentsForDay = foundAppointments.filter((appointment) => {
        // Converting requested date to ms time and making sure the appointment time is in between
        const startOfRequestedDate = new Date(`${args.date}T00:00:00Z`);
        const endOfRequestedDate = new Date(startOfRequestedDate.getTime());
        endOfRequestedDate.setUTCDate(startOfRequestedDate.getUTCDate() + 1);
        return (
          new Date(appointment.time).getTime() > startOfRequestedDate.getTime() &&
          new Date(appointment.time).getTime() < endOfRequestedDate.getTime()
        );
      });
      // Returning appointments for day sorted by date ASC
      return foundAppointmentsForDay.sort(function (a, b) {
        return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
      });
    },
    email: async (parent, _, { user }) => {
      if (user?.email === parent.email && user?.permissions?.includes('read:barber_data')) {
        return parent.email;
      }
      throw new AuthenticationError('Unauthorized');
    },
  },
};

export default resolvers;
