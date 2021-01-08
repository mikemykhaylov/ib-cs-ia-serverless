const { DataSource } = require('apollo-datasource');
const { UserInputError } = require('apollo-server-lambda');
const mongoose = require('mongoose');

const Appointment = require('../models/Appointment');
const Barber = require('../models/Barber');

const appointmentPrep = (appointment) => {
  // We convert Mongoose Document to object, otherwise cannot reassign time
  const appointmentObject = appointment.toObject({ virtuals: true });
  appointmentObject.time = new Date(appointmentObject.time).toISOString();
  // Deleting name property, because we already casted fullName virtual
  // Not really needed, but if we dedicate a function to processing, why not clean up a bit?
  delete appointmentObject.name;
  return appointmentObject;
};

class MongodbAPI extends DataSource {
  static async getAppointments({ barberID, date }) {
    const searchCriteria = {};
    if (date) {
      // date: yyyy-mm-dd
      const [year, month, day] = date.split('-');
      searchCriteria.time = {
        $gte: `${year}-${month}-${day}`,
        $lt: `${year}-${month}-${(+day + 1).toString(10).padStart(2, '0')}`,
      };
    }
    if (barberID) {
      searchCriteria.barberID = mongoose.Types.ObjectId(barberID);
    }
    const foundAppointments = await Appointment.find(searchCriteria);
    return Array.isArray(foundAppointments) ? foundAppointments.map(appointmentPrep) : [];
  }

  static async getAppointment({ appointmentID }) {
    const foundAppointment = await Appointment.findById(appointmentID);
    return appointmentPrep(foundAppointment);
  }

  static async getBarbers({ dateTime }) {
    //! The only time we populate an ID field
    // Other times ID is passed from prev resolver and we make a separate request
    let barbersRequest = Barber.find({});
    if (dateTime) {
      // If we recieve dateTime, it means we are looking for free barbers
      // Because of that, we populate the appointments of each...
      barbersRequest = barbersRequest.populate({ path: 'appointmentIDS' });
    }
    const foundBarbers = await barbersRequest.exec();

    if (!dateTime) {
      return foundBarbers;
    }
    // ... and filter out barbers that have any appointment at specified time
    const freeBarbers = foundBarbers.filter(
      (barber) =>
        !barber.appointmentIDS.some(
          (appointment) => appointment.time.getTime() === new Date(dateTime).getTime(),
        ),
    );
    return freeBarbers;
  }

  static async getBarber({ barberID }) {
    const foundBarber = await Barber.findById(barberID);
    return foundBarber;
  }

  static async createAppointment({ input }) {
    // Checking if the barber with said ID exists
    const assignedBarber = await Barber.findById(input.barberID);
    if (!assignedBarber) {
      throw new UserInputError('Barber ID is invalid');
    }

    const appointmentData = { ...input, barberID: mongoose.Types.ObjectId(input.barberID) };
    const createdAppointment = await Appointment.create(appointmentData);
    // Add appointment ID to barber's appointmentIDS array
    await Barber.findByIdAndUpdate(input.barberID, {
      $push: { appointmentIDS: createdAppointment._id },
    });
    return appointmentPrep(createdAppointment);
  }

  static async createBarber({ input: barberData }) {
    const createdBarber = await Barber.create(barberData);
    return createdBarber;
  }
}

module.exports = MongodbAPI;
