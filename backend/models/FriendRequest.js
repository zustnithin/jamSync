const mongoose = require('mongoose');

// A pending friend request from one user to another.
// Usernames stored lowercase for matching + original casing for display.
const friendRequestSchema = new mongoose.Schema(
  {
    fromLower: { type: String, required: true },
    fromName: { type: String, required: true },
    toLower: { type: String, required: true },
    toName: { type: String, required: true },
  },
  { timestamps: true }
);

// One pending request per direction at most.
friendRequestSchema.index({ fromLower: 1, toLower: 1 }, { unique: true });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
