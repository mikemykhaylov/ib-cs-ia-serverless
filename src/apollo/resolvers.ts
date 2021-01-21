import { AuthenticationError, IResolvers } from 'apollo-server-lambda';
import { Auth0ManagementToken } from '../handlers';
import { AppointmentDocumentObject } from '../models/Appointment';
import { BarberDocument, BarberDocumentPopulated } from '../models/Barber';
import MongodbAPI, {
  CreateAppointmentInput,
  CreateBarberInput,
  GetAppointmentInput,
  GetAppointmentsInput,
  GetBarberInput,
  GetBarbersInput,
} from './mongodbAPI';

type Resolver<Parent, Args, Result> = (
  parent: Parent,
  args: Args,
  context: {
    dataSources: { mongodbAPI: MongodbAPI };
    user?: { email: string };
    permissions?: string[];
    managementToken: Auth0ManagementToken;
  },
) => Promise<Result>;

interface Resolvers extends IResolvers {
  Query: {
    appointments: Resolver<undefined, GetAppointmentsInput, AppointmentDocumentObject[]>;
    appointment: Resolver<undefined, GetAppointmentInput, AppointmentDocumentObject | undefined>;
    barbers: Resolver<undefined, GetBarbersInput, (BarberDocument | BarberDocumentPopulated)[]>;
    barber: Resolver<undefined, GetBarberInput, BarberDocument | undefined>;
  };
  Mutation: {
    createAppointment: Resolver<undefined, CreateAppointmentInput, AppointmentDocumentObject>;
    createBarber: Resolver<undefined, CreateBarberInput, BarberDocument>;
  };
  Appointment: {
    barber: Resolver<AppointmentDocumentObject, null, BarberDocument>;
    fullName: Resolver<AppointmentDocumentObject, null, string>;
    email: Resolver<AppointmentDocumentObject, null, string>;
    phoneNumber: Resolver<AppointmentDocumentObject, null, string>;
  };
  Barber: {
    appointments: Resolver<BarberDocument, { date: string }, AppointmentDocumentObject[]>;
    email: Resolver<BarberDocument, null, string>;
  };
}

const protectedAppointmentProperty: (
  property: 'email' | 'fullName' | 'phoneNumber',
) => Resolver<AppointmentDocumentObject, null, string> = (property) => {
  return async (parent, _, { dataSources, user, permissions }) => {
    if (user && permissions) {
      const assignedBarber = (await dataSources.mongodbAPI.getBarber({
        email: user.email,
      })) as BarberDocument;
      if (user.email === assignedBarber.email && permissions.includes('read:contactInfo')) {
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
  },
  Mutation: {
    // Used for:
    // 1) Creating an appointment (used in GetDetails)
    createAppointment: async (_, args, { dataSources }) => {
      const createdAppointment = await dataSources.mongodbAPI.createAppointment(args);
      return createdAppointment;
    },
    // Used for:
    // 1) Creating a barber (dev use)
    createBarber: async (_, args, { dataSources }) => {
      const createdBarber = await dataSources.mongodbAPI.createBarber(args);
      return createdBarber;
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
    fullName: protectedAppointmentProperty('fullName'),
    email: protectedAppointmentProperty('email'),
    phoneNumber: protectedAppointmentProperty('phoneNumber'),
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
        return foundAppointments;
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
      return foundAppointmentsForDay;
    },
    email: async (parent, _, { user, permissions }) => {
      if (user && permissions) {
        if (user.email === parent.email && permissions.includes('read:contactInfo')) {
          return parent.email;
        }
      }
      throw new AuthenticationError('Unauthorized');
    },
  },
};

export default resolvers;
