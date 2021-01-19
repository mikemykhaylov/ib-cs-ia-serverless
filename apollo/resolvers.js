/* eslint-disable arrow-body-style */
module.exports = {
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
    appointment: async (_, { appointmentID }, { dataSources }) => {
      const foundAppointment = await dataSources.mongodbAPI.getAppointment({ appointmentID });
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
      const foundBarber = await dataSources.mongodbAPI.getBarber({ barberID: parent.barberID });
      return foundBarber;
    },
  },
  Barber: {
    // Used for:
    // 1) Listing all appointments of specific barber from barber's appointmentIDS (used in Dashboard)
    appointments: async (parent, args, { dataSources }) => {
      const foundAppointmentsPromises = parent.appointmentIDS.map((appointmentID) => {
        return dataSources.mongodbAPI.getAppointment({ appointmentID });
      });
      const foundAppointments = await Promise.all(foundAppointmentsPromises);

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
          appointment.time > startOfRequestedDate.getTime() &&
          appointment.time < endOfRequestedDate.getTime()
        );
      });
      return foundAppointmentsForDay;
    },
  },
};
