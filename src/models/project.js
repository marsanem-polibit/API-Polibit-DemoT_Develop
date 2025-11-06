// models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  image: {
    type: String,
    default: null,
    trim: true
  },
  anualRate: {
    type: Number,
    required: [true, 'Annual rate is required'],
    min: [0, 'Annual rate must be positive'],
    max: [100, 'Annual rate cannot exceed 100%']
  },
  estimateGain: {
    type: Number,
    required: [true, 'Estimate gain is required'],
    min: [0, 'Estimate gain must be positive']
  },
  minimumTicketUSD: {
    type: Number,
    required: [true, 'Minimum ticket USD is required'],
    min: [0, 'Minimum ticket USD must be positive']
  },
  minumumTicketMXN: {
    type: Number,
    required: [true, 'Minimum ticket MXN is required'],
    min: [0, 'Minimum ticket MXN must be positive']
  },
  available: {
    type: Boolean,
    default: false,
    index: true
  },
  paused: {
    type: Boolean,
    default: false,
    index: true
  },
  userCreatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User Creator ID is required'],
    index: true
  },
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound index for filtering available and not paused projects
projectSchema.index({ available: 1, paused: 1 });

// Static method to find all available projects
projectSchema.statics.findAvailable = function() {
  return this.find({ available: true, paused: false }).sort({ anualRate: -1 });
};

// Static method to find projects by minimum ticket range
projectSchema.statics.findByTicketRange = function(minUSD, maxUSD) {
  return this.find({
    minimumTicketUSD: { $gte: minUSD, $lte: maxUSD },
    available: true,
    paused: false
  }).sort({ anualRate: -1 });
};

// Static method to find by address (partial match)
projectSchema.statics.findByAddress = function(addressQuery) {
  return this.find({
    address: { $regex: addressQuery, $options: 'i' }
  });
};

// Instance method to check if project is actively available
projectSchema.methods.isActivelyAvailable = function() {
  return this.available && !this.paused;
};

// Instance method to calculate estimated return for a given investment amount
projectSchema.methods.calculateEstimatedReturn = function(investmentAmount, currency = 'USD') {
  const minTicket = currency === 'USD' ? this.minimumTicketUSD : this.minumumTicketMXN;

  if (investmentAmount < minTicket) {
    throw new Error(`Investment amount must be at least ${minTicket} ${currency}`);
  }

  const annualReturn = (investmentAmount * this.anualRate) / 100;
  const totalReturn = investmentAmount + annualReturn;

  return {
    investmentAmount,
    currency,
    annualRate: this.anualRate,
    estimatedAnnualReturn: annualReturn,
    estimatedTotalReturn: totalReturn,
    estimatedGain: this.estimateGain
  };
};

// Instance method to mark as available
projectSchema.methods.makeAvailable = function() {
  this.available = true;
  this.paused = false;
  return this.save();
};

// Instance method to mark as unavailable
projectSchema.methods.makeUnavailable = function() {
  this.available = false;
  return this.save();
};

// Instance method to pause
projectSchema.methods.pause = function() {
  this.paused = true;
  return this.save();
};

// Instance method to unpause
projectSchema.methods.unpause = function() {
  this.paused = false;
  return this.save();
};

// Virtual for checking if it's an active project
projectSchema.virtual('isActive').get(function() {
  return this.available && !this.paused;
});

// Ensure virtuals are included when converting to JSON
projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
