// models/SmartContract.js
const mongoose = require('mongoose');

const smartContractSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project ID is required'],
    index: true
  },
  complianceRegistryAddress: {
    type: String,
    required: [true, 'Compliance Registry Address is required'],
    trim: true
  },
  contractAddress: {
    type: String,
    required: [true, 'Contract Address is required'],
    trim: true,
    unique: true,
    index: true
  },
  factoryAddress: {
    type: String,
    required: [true, 'Factory Address is required'],
    trim: true
  },
  identityRegistryAddress: {
    type: String,
    required: [true, 'Identity Registry Address is required'],
    trim: true
  },
  company: {
    type: String,
    required: [true, 'Company is required'],
    trim: true
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    trim: true,
    uppercase: true,
    default: 'USD'
  },
  maxTokens: {
    type: Number,
    required: [true, 'Max tokens is required'],
    min: [0, 'Max tokens must be positive']
  },
  mintedTokens: {
    type: String,
    required: [true, 'Minted tokens is required'],
    trim: true,
    default: '0'
  },
  projectName: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  tokenName: {
    type: String,
    required: [true, 'Token name is required'],
    trim: true
  },
  tokenSymbol: {
    type: String,
    required: [true, 'Token symbol is required'],
    trim: true,
    uppercase: true
  },
  tokenValue: {
    type: String,
    required: [true, 'Token value is required'],
    trim: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for efficient queries
smartContractSchema.index({ projectId: 1, contractAddress: 1 });

// Static method to find by project ID
smartContractSchema.statics.findByProjectId = function(projectId) {
  return this.findOne({ projectId }).populate('projectId');
};

// Static method to find by contract address
smartContractSchema.statics.findByContractAddress = function(contractAddress) {
  return this.findOne({ contractAddress: contractAddress.trim() }).populate('projectId');
};

// Static method to find by company
smartContractSchema.statics.findByCompany = function(company) {
  return this.find({ company: { $regex: company, $options: 'i' } }).populate('projectId');
};

// Static method to find by token symbol
smartContractSchema.statics.findByTokenSymbol = function(tokenSymbol) {
  return this.find({ tokenSymbol: tokenSymbol.toUpperCase() }).populate('projectId');
};

// Instance method to update minted tokens
smartContractSchema.methods.updateMintedTokens = function(amount) {
  this.mintedTokens = amount.toString();
  return this.save();
};

// Instance method to get minting progress
smartContractSchema.methods.getMintingProgress = function() {
  const minted = parseInt(this.mintedTokens, 10);
  const max = this.maxTokens;
  const percentage = max > 0 ? (minted / max) * 100 : 0;

  return {
    mintedTokens: minted,
    maxTokens: max,
    remainingTokens: max - minted,
    progressPercentage: percentage.toFixed(2),
    isFullyMinted: minted >= max
  };
};

// Instance method to check if more tokens can be minted
smartContractSchema.methods.canMintMore = function() {
  const minted = parseInt(this.mintedTokens, 10);
  return minted < this.maxTokens;
};

// Virtual for checking if contract is fully minted
smartContractSchema.virtual('isFullyMinted').get(function() {
  const minted = parseInt(this.mintedTokens, 10);
  return minted >= this.maxTokens;
});

// Ensure virtuals are included when converting to JSON
smartContractSchema.set('toJSON', { virtuals: true });
smartContractSchema.set('toObject', { virtuals: true });

const SmartContract = mongoose.model('SmartContract', smartContractSchema);

module.exports = SmartContract;
