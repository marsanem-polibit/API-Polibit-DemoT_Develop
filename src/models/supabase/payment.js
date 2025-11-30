/**
 * Payment Supabase Model
 * Handles structure investment payment data
 */

const { getSupabase } = require('../../config/database');

class Payment {
  /**
   * Convert camelCase fields to snake_case for database
   */
  static _toDbFields(data) {
    const dbData = {};
    const fieldMap = {
      id: 'id',
      email: 'email',
      submissionId: 'submission_id',
      paymentImage: 'payment_image',
      transactionHash: 'transaction_hash',
      amount: 'amount',
      structureId: 'structure_id',
      contractId: 'contract_id',
      status: 'status',
      tokenId: 'token_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
      if (data[camelKey] !== undefined) {
        dbData[snakeKey] = data[camelKey];
      }
    }

    return dbData;
  }

  /**
   * Convert snake_case database fields to camelCase for model
   */
  static _toModel(dbData) {
    if (!dbData) return null;

    return {
      id: dbData.id,
      email: dbData.email,
      submissionId: dbData.submission_id,
      paymentImage: dbData.payment_image,
      transactionHash: dbData.transaction_hash,
      amount: dbData.amount,
      structureId: dbData.structure_id,
      contractId: dbData.contract_id,
      status: dbData.status,
      tokenId: dbData.token_id,
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at
    };
  }

  /**
   * Create a new payment record
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} Created payment
   */
  static async create(data) {
    const supabase = getSupabase();
    const dbData = this._toDbFields(data);

    const { data: result, error } = await supabase
      .from('payments')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;

    return this._toModel(result);
  }

  /**
   * Find payment by ID
   * @param {string} id - Payment ID
   * @returns {Promise<Object|null>} Payment or null
   */
  static async findById(id) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this._toModel(data);
  }

  /**
   * Find payment by submission ID
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object|null>} Payment or null
   */
  static async findBySubmissionId(submissionId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('submission_id', submissionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this._toModel(data);
  }

  /**
   * Find payment by transaction hash
   * @param {string} transactionHash - Transaction hash
   * @returns {Promise<Object|null>} Payment or null
   */
  static async findByTransactionHash(transactionHash) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_hash', transactionHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this._toModel(data);
  }

  /**
   * Find payments by email
   * @param {string} email - Email address
   * @returns {Promise<Array>} Array of payments
   */
  static async findByEmail(email) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('email', email.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => this._toModel(item));
  }

  /**
   * Find payments by structure ID
   * @param {string} structureId - Structure ID
   * @returns {Promise<Array>} Array of payments
   */
  static async findByStructureId(structureId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('structure_id', structureId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => this._toModel(item));
  }

  /**
   * Find payments by contract ID
   * @param {string} contractId - Contract ID
   * @returns {Promise<Array>} Array of payments
   */
  static async findByContractId(contractId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => this._toModel(item));
  }

  /**
   * Find payments by status
   * @param {string} status - Payment status
   * @returns {Promise<Array>} Array of payments
   */
  static async findByStatus(status) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => this._toModel(item));
  }

  /**
   * Find payments by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Array of payments
   */
  static async find(criteria = {}) {
    const supabase = getSupabase();
    const dbCriteria = this._toDbFields(criteria);

    let query = supabase.from('payments').select('*');

    Object.entries(dbCriteria).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return data.map(item => this._toModel(item));
  }

  /**
   * Update payment by ID
   * @param {string} id - Payment ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated payment
   */
  static async findByIdAndUpdate(id, updateData) {
    const supabase = getSupabase();
    const dbData = this._toDbFields(updateData);

    const { data, error } = await supabase
      .from('payments')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this._toModel(data);
  }

  /**
   * Delete payment by ID
   * @param {string} id - Payment ID
   * @returns {Promise<Object>} Deleted payment
   */
  static async findByIdAndDelete(id) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this._toModel(data);
  }

  /**
   * Update payment status
   * @param {string} id - Payment ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated payment
   */
  static async updateStatus(id, status) {
    return this.findByIdAndUpdate(id, { status });
  }

  /**
   * Update transaction hash
   * @param {string} id - Payment ID
   * @param {string} transactionHash - Transaction hash
   * @returns {Promise<Object>} Updated payment
   */
  static async updateTransactionHash(id, transactionHash) {
    return this.findByIdAndUpdate(id, { transactionHash });
  }
}

module.exports = Payment;
