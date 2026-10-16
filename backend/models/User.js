const mongoose = require('mongoose');

// One document per signed-up user.
// usernameLower (unique) makes "Nithin" and "nithin" collide on purpose.
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
