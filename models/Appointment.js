const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  duration: Number,
  email: String,
  name: {
    first: String,
    last: String,
  },
  phoneNumber: String,
  serviceName: { type: String, enum: ['HAIRCUT', 'SHAVING', 'COMBO', 'FATHER&SON', 'JUNIOR'] },
  time: Date,
  barberID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
  },
});

AppointmentSchema.virtual('fullName')
  .get(function fullNameGetter() {
    return `${this.name.first} ${this.name.last}`;
  })
  .set(function fullNameSetter(val) {
    this.name.first = val.substr(0, val.indexOf(' '));
    this.name.last = val.substr(val.indexOf(' ') + 1);
  });

module.exports = mongoose.model('Appointment', AppointmentSchema);
