import mongoose, { Model, Schema, Types, Document } from 'mongoose';
import { BarberDocument } from './Barber';

export enum ServiceName {
  Haircut = 'HAIRCUT',
  Shaving = 'SHAVING',
  Combo = 'COMBO',
  Fatherson = 'FATHERSON',
  Junior = 'JUNIOR',
}

export interface Appointment {
  duration: number;
  email: string;
  name: {
    first: string;
    last: string;
  };
  phoneNumber: string;
  serviceName: ServiceName;
  time: string | Date;
  barberID: Types.ObjectId;
}

export interface AppointmentDocumentObject extends Appointment {
  fullName: string;
  id: string;
}

export interface AppointmentDocument extends AppointmentDocumentObject, Document {
  id: string;
  time: Date;
}

export interface AppointmentDocumentPopulated
  extends Omit<AppointmentDocumentObject, 'barberID'>,
    Document {
  barberID: BarberDocument;
  id: string;
  time: Date;
}

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
