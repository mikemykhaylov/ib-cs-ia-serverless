import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { AppointmentDocument } from './Appointment';

export enum Specialisation {
  Beards = 'BEARDS',
  Haircuts = 'HAIRCUTS',
}

export interface Barber {
  email: string;
  name: {
    first: string;
    last: string;
  };
  profileImageURL: string;
  specialisation: Specialisation;
  completed?: boolean;
}

interface BarberBaseDocument extends Barber, Document {
  fullName: string;
}

export interface BarberDocument extends BarberBaseDocument {
  appointmentIDS: Types.Array<Types.ObjectId>;
}

export interface BarberDocumentPopulated extends BarberBaseDocument {
  appointmentIDS: Types.Array<AppointmentDocument>;
}

const BarberSchema: Schema<BarberDocument, Model<BarberDocument>> = new Schema({
  email: { type: String, unique: true, required: true },
  name: {
    first: { type: String, required: true },
    last: { type: String, required: true },
  },
  profileImageURL: { type: String, unique: true },
  specialisation: { type: String, enum: Object.values(Specialisation), required: true },
  // Determines if the barber has filled all personal details
  // False by default, because barbers are created in Auth0 Hook
  // which doesn't provide a way to enter more information
  // Will be set to true when barber fills specialisation, name and profileImageURL
  completed: { type: Boolean, default: false },
  appointmentIDS: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
  ],
});

BarberSchema.virtual('fullName')
  .get(function fullNameGetter(this: BarberBaseDocument) {
    return `${this.name.first} ${this.name.last}`;
  })
  .set(function fullNameSetter(this: BarberBaseDocument, val: string) {
    this.name.first = val.substr(0, val.indexOf(' '));
    this.name.last = val.substr(val.indexOf(' ') + 1);
  });

export default mongoose.model<BarberDocument, Model<BarberDocument>>('Barber', BarberSchema);
