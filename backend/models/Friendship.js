const mongoose = require('mongoose');

// One document per friendship. pair is always sorted [a, b] (lowercase)
// so (x, y) and (y, x) can never exist twice.
const friendshipSchema = new mongoose.Schema(
  {
    pair: { type: [String], required: true },
  },
  { timestamps: true }
);

friendshipSchema.index({ pair: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);
