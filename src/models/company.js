// models/Company.js
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  firmName: {
    type: String,
    trim: true,
    default: ''
  },
  firmLogo: {
    type: String,
    default: null,
    trim: true
  },
  firmEmail: {
    type: String,
    lowercase: true,
    trim: true,
    default: '',
    validate: {
      validator: function(v) {
        // Allow empty string, but if provided, must be valid email
        return v === '' || /^\S+@\S+\.\S+$/.test(v);
      },
      message: 'Please provide a valid email'
    }
  },
  firmPhone: {
    type: String,
    trim: true,
    default: ''
  },
  websiteURL: {
    type: String,
    trim: true,
    default: '',
    validate: {
      validator: function(v) {
        // Allow empty string, but if provided, must be valid URL
        // More permissive regex that allows localhost, IPs, ports, and various paths
        return v === '' || /^(https?:\/\/)?([\w.-]+(:\d+)?)(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i.test(v);
      },
      message: 'Please provide a valid URL'
    }
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Static method to find by user ID
companySchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

// Static method to find by firm email
companySchema.statics.findByEmail = function(email) {
  return this.findOne({ firmEmail: email.toLowerCase() });
};

const Company = mongoose.model('Company', companySchema);

module.exports = Company;
