const mongoose = require('mongoose');

const BarberSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  name: {
    first: String,
    last: String,
  },
  profileImageURL: { type: String, unique: true },
  specialisation: { type: String, enum: ['BEARDS', 'HAIRCUTS'] },
  appointmentIDS: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
  ],
});

BarberSchema.virtual('fullName')
  .get(function fullNameGetter() {
    return `${this.name.first} ${this.name.last}`;
  })
  .set(function fullNameSetter(val) {
    this.name.first = val.substr(0, val.indexOf(' '));
    this.name.last = val.substr(val.indexOf(' ') + 1);
  });

module.exports = mongoose.model('Barber', BarberSchema);
