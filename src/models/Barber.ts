import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { AppointmentDocument } from './Appointment';

enum Specialisation {
  Beards = 'BEARDS',
  Haircuts = 'HAIRCUTS',
}

// Data passed as GraphQl argument to createBarber mutation
// Barbers need a separate interface for mongoose because
// there are properties that we do not wish to store in MongoDB,
// such as passwords. We do, however need profileImageURL, which is
// recieved later
export interface CreateBarberInput {
  email: string;
  name: {
    first: string;
    last: string;
  };
  specialisation: Specialisation;
  password: string;
}

// Data passed as argument to Mongoose.create
export interface CreateBarberMongoInput extends Omit<CreateBarberInput, 'password'> {
  profileImageURL: string;
}

// Data passed as GraphQl argument to updateBarber mutation
// Also passed as argument to Mongoose.update
// Barbers don't need a separate interface for mongoose because
// there are no weird types in the model (like Date, which has to be passed as Date)
export interface UpdateBarberInput {
  email?: string;
  name?: {
    first: string;
    last: string;
  };
  profileImageURL?: string;
  specialisation?: Specialisation;
}

// Generic MongoDB document, population of appointmentIDS isnt specified
// Inherits CreateBarberMongoInput because everything is required there
// Internal use
interface BarberBaseDocument extends CreateBarberMongoInput, Document {
  fullName: string;
}

// Unpopulated MongoDB document
export interface BarberDocument extends BarberBaseDocument {
  appointmentIDS: Types.Array<Types.ObjectId>;
}

// Populated MongoDB document
export interface BarberDocumentPopulated extends BarberBaseDocument {
  appointmentIDS: Types.Array<AppointmentDocument>;
}

// MongoDB Schema
const BarberSchema: Schema<BarberDocument, Model<BarberDocument>> = new Schema({
  email: { type: String, unique: true, required: true },
  name: {
    first: { type: String, required: true },
    last: { type: String, required: true },
  },
  profileImageURL: { type: String, required: true },
  specialisation: { type: String, enum: Object.values(Specialisation), required: true },
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
