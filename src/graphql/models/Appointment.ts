import mongoose, { Model, Schema, Types, Document } from 'mongoose';
import { BarberDocument } from './Barber';

enum ServiceName {
  Haircut = 'HAIRCUT',
  Shaving = 'SHAVING',
  Combo = 'COMBO',
  Fatherson = 'FATHERSON',
  Junior = 'JUNIOR',
}

// Data passed as GraphQl argument to createAppointment mutation
export interface CreateAppointmentInput {
  duration: number;
  email: string;
  name: {
    first: string;
    last: string;
  };
  phoneNumber: string;
  serviceName: ServiceName;
  time: string;
  barberID: Types.ObjectId;
}

// Data passed as GraphQl argument to updateAppointment mutation
export interface UpdateAppointmentInput {
  duration?: number;
  email?: string;
  name?: {
    first: string;
    last: string;
  };
  phoneNumber?: string;
  serviceName?: ServiceName;
  time?: string;
  barberID?: Types.ObjectId;
}

// Data passed as Mongoose.create argument
// Appointments need a separate interface for mongoose because
// they have a time property of type Date, which has to be converted to Date
// before creating a document in the database
export interface CreateAppointmentMongoInput extends Omit<CreateAppointmentInput, 'time'> {
  time: Date;
}
// Data passed as Mongoose.update argument
// Appointments need a separate interface for mongoose because
// they have a time property of type Date, which has to be converted to Date
// before updating a document in the database
export interface UpdateAppointmentMongoInput extends Omit<UpdateAppointmentInput, 'time'> {
  time?: Date;
}

// MongoDB document converted to object
export interface AppointmentDocumentObject extends Omit<CreateAppointmentInput, 'time'> {
  time: Date;
  fullName: string;
  id: string;
}

// Unpopulated MongoDB document
export interface AppointmentDocument extends AppointmentDocumentObject, Document {
  id: string;
}

// Populated MongoDB document
export interface AppointmentDocumentPopulated
  extends Omit<AppointmentDocumentObject, 'barberID'>,
    Document {
  id: string;
  barberID: BarberDocument;
}

// MongoDB schema
const AppointmentSchema: Schema<AppointmentDocument, Model<AppointmentDocument>> = new Schema({
  duration: { type: String, required: true },
  email: String,
  name: {
    first: { type: String, required: true },
    last: { type: String, required: true },
  },
  phoneNumber: { type: String, required: true },
  serviceName: { type: String, enum: Object.values(ServiceName), required: true },
  time: Date,
  barberID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
    required: true,
  },
});

AppointmentSchema.virtual('fullName')
  .get(function fullNameGetter(this: AppointmentDocumentObject) {
    return `${this.name.first} ${this.name.last}`;
  })
  .set(function fullNameSetter(this: AppointmentDocumentObject, val: string) {
    this.name.first = val.substr(0, val.indexOf(' '));
    this.name.last = val.substr(val.indexOf(' ') + 1);
  });

export default mongoose.model<AppointmentDocument, Model<AppointmentDocument>>(
  'Appointment',
  AppointmentSchema,
);
