/**
 * Transaction Supabase Model
 * Handles payment submissions and approvals for structure investments
 */

const { getSupabase } = require('../../config/database');

class Transaction {
  /**
   * Convert camelCase fields to snake_case for database
   */
  static _toDbFields(data) {
    const dbData = {};
    const fieldMap = {
      id: 'id',
      investorId: 'investor_id',
      structureId: 'structure_id',
      investorEmail: 'investor_email',
      investorName: 'investor_name',
      structureName: 'structure_name',
      ticketsPurchased: 'tickets_purchased',
      totalAmount: 'total_amount',
      paymentMethod: 'payment_method',
      receiptUrl: 'receipt_url',
      receiptFileName: 'receipt_file_name',
      walletAddress: 'wallet_address',
      status: 'status',
      submittedAt: 'submitted_at',
      processedAt: 'processed_at',
      processedBy: 'processed_by',
      adminNotes: 'admin_notes',
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
      investorId: dbData.investor_id,
      structureId: dbData.structure_id,
      investorEmail: dbData.investor_email,
      investorName: dbData.investor_name,
      structureName: dbData.structure_name,
      ticketsPurchased: dbData.tickets_purchased,
      totalAmount: parseFloat(dbData.total_amount), // Convert to number
      paymentMethod: dbData.payment_method,
      receiptUrl: dbData.receipt_url,
      receiptFileName: dbData.receipt_file_name,
      walletAddress: dbData.wallet_address,
      status: dbData.status,
      submittedAt: dbData.submitted_at,
      processedAt: dbData.processed_at,
      processedBy: dbData.processed_by,
      adminNotes: dbData.admin_notes,
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at
    };
  }

  /**
   * Create a new transaction (investor submits payment)
   */
  static async create(transactionData) {
    const supabase = getSupabase();
    const dbData = this._toDbFields(transactionData);

    const { data, error } = await supabase
      .from('transactions')
      .insert([dbData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating transaction: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Find transaction by ID
   */
  static async findById(id) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error finding transaction: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Find all transactions with optional filters
   */
  static async findAll(options = {}) {
    const supabase = getSupabase();

    let query = supabase.from('transactions').select('*');

    // Apply filters
    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.investorId) {
      query = query.eq('investor_id', options.investorId);
    }

    if (options.structureId) {
      query = query.eq('structure_id', options.structureId);
    }

    if (options.paymentMethod) {
      query = query.eq('payment_method', options.paymentMethod);
    }

    // Order by submitted date (newest first)
    query = query.order('submitted_at', { ascending: false });

    // Apply pagination if provided
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching transactions: ${error.message}`);
    }

    return data.map(item => this._toModel(item));
  }

  /**
   * Update transaction
   */
  static async update(id, updates) {
    const supabase = getSupabase();
    const dbData = this._toDbFields(updates);

    const { data, error } = await supabase
      .from('transactions')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating transaction: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Approve transaction
   */
  static async approve(id, adminUserId, adminNotes = null) {
    const updates = {
      status: 'approved',
      processedAt: new Date().toISOString(),
      processedBy: adminUserId,
    };

    if (adminNotes) {
      updates.adminNotes = adminNotes;
    }

    return this.update(id, updates);
  }

  /**
   * Reject transaction
   */
  static async reject(id, adminUserId, adminNotes = null) {
    const updates = {
      status: 'rejected',
      processedAt: new Date().toISOString(),
      processedBy: adminUserId,
    };

    if (adminNotes) {
      updates.adminNotes = adminNotes;
    }

    return this.update(id, updates);
  }

  /**
   * Get transaction statistics
   */
  static async getStats() {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('transactions')
      .select('status, total_amount');

    if (error) {
      throw new Error(`Error fetching transaction stats: ${error.message}`);
    }

    const stats = {
      total: data.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
      pendingAmount: 0,
      approvedAmount: 0,
    };

    data.forEach(transaction => {
      const amount = parseFloat(transaction.total_amount);
      stats.totalAmount += amount;

      if (transaction.status === 'pending') {
        stats.pending++;
        stats.pendingAmount += amount;
      } else if (transaction.status === 'approved') {
        stats.approved++;
        stats.approvedAmount += amount;
      } else if (transaction.status === 'rejected') {
        stats.rejected++;
      }
    });

    return stats;
  }

  /**
   * Delete transaction (soft delete by marking as rejected)
   */
  static async delete(id) {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting transaction: ${error.message}`);
    }

    return true;
  }
}

module.exports = Transaction;
