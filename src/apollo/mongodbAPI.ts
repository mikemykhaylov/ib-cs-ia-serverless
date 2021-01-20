import { DataSource } from 'apollo-datasource';
import { UserInputError } from 'apollo-server-lambda';
import mongoose, { Types } from 'mongoose';
import AppointmentModel, {
  Appointment,
  AppointmentDocument,
  AppointmentDocumentObject,
} from '../models/Appointment';
import BarberModel, { Barber, BarberDocument, BarberDocumentPopulated } from '../models/Barber';

const appointmentPrep: (appointment: AppointmentDocument) => AppointmentDocumentObject = (
  appointment,
) => {
  // We convert Mongoose Document to object, otherwise cannot reassign time
  const appointmentObject = appointment.toObject({ virtuals: true }) as AppointmentDocumentObject;
  appointmentObject.time = new Date(appointmentObject.time).toISOString();
  // name property persists, as it is required in AppointmentDocumentObject
  return appointmentObject;
};

export type GetAppointmentsInput = { barberID?: string; date?: string };
export type GetAppointmentInput = { appointmentID: string };
export type GetBarbersInput = { dateTime: string };
export type GetBarberInput = { barberID?: string; email?: string };
export type CreateAppointmentInput = { input: Appointment };
export type CreateBarberInput = { input: Barber };

class MongodbAPI extends DataSource {
  async getAppointments({
    barberID,
    date,
  }: GetAppointmentsInput): Promise<AppointmentDocumentObject[]> {
    const searchCriteria: {
      barberID?: Types.ObjectId;
      time?: {
        $gte: Date;
        $lt: Date;
      };
    } = {};

    if (date) {
      // date: yyyy-mm-dd
      const [year, month, day] = date.split('-');
      searchCriteria.time = {
        $gte: new Date(Date.UTC(+year, +month, +day)),
        $lt: new Date(Date.UTC(+year, +month, +day + 1)),
      };
    }
    if (barberID) {
      searchCriteria.barberID = mongoose.Types.ObjectId(barberID);
    }
    const foundAppointments = await AppointmentModel.find(searchCriteria);
    return Array.isArray(foundAppointments) ? foundAppointments.map(appointmentPrep) : [];
  }

  async getAppointment({
    appointmentID,
  }: GetAppointmentInput): Promise<AppointmentDocumentObject | undefined> {
    try {
      const foundAppointment = await AppointmentModel.findById(appointmentID);
      if (foundAppointment) {
        return appointmentPrep(foundAppointment);
      }
    } catch (err) {
      throw new UserInputError('Appointment ID is invalid');
    }
  }

  async getBarbers({
    dateTime,
  }: GetBarbersInput): Promise<Array<BarberDocument | BarberDocumentPopulated>> {
    //! The only time we populate an ID field
    // Other times ID is passed from prev resolver and we make a separate request
    let barbersRequest = BarberModel.find({ completed: true });
    if (!dateTime) {
      const foundBarbers = await barbersRequest.exec();
      return foundBarbers;
    } else {
      // If we recieve dateTime, it means we are looking for free barbers
      // Because of that, we populate the appointments of each...
      barbersRequest = barbersRequest.populate({ path: 'appointmentIDS' });
      const foundBarbers = ((await barbersRequest.exec()) as unknown) as BarberDocumentPopulated[];
      // ... and filter out barbers that have any appointment at specified time
      const freeBarbers = foundBarbers.filter(
        (barber) =>
          !barber.appointmentIDS.some(
            (appointment) => appointment.time.getTime() === new Date(dateTime).getTime(),
          ),
      );
      return freeBarbers;
    }
  }

  async getBarber({ barberID, email }: GetBarberInput): Promise<BarberDocument | undefined> {
    let foundBarber;
    try {
      if (barberID) {
        foundBarber = await BarberModel.findById(barberID);
      } else if (email) {
        foundBarber = await BarberModel.findOne({ email });
      } else {
        throw new Error('No input provided');
      }
      if (foundBarber) {
        return foundBarber;
      }
    } catch (err) {
      throw new UserInputError(err.message || 'Barber not found');
    }
  }

  async createAppointment({ input }: CreateAppointmentInput): Promise<AppointmentDocumentObject> {
    // Checking if the barber with said ID exists
    const assignedBarber = await BarberModel.findById(input.barberID);
    if (!assignedBarber) {
      throw new UserInputError('Barber ID is invalid');
    }

    const appointmentData = { ...input };
    const createdAppointment = await AppointmentModel.create(appointmentData);
    // Add appointment ID to barber's appointmentIDS array
    await BarberModel.findByIdAndUpdate(input.barberID, {
      $push: { appointmentIDS: createdAppointment._id },
    });
    return appointmentPrep(createdAppointment);
  }

  async createBarber({ input }: CreateBarberInput): Promise<BarberDocument> {
    const createdBarber = await BarberModel.create(input);
    return createdBarber;
  }
}

export default MongodbAPI;
