/**
 * Email Domain Supabase Model
 * Manages email domain configuration for white-label email sending
 */

const { getSupabase } = require('../../config/database');

class EmailDomain {
  /**
   * Convert camelCase fields to snake_case for database
   */
  static _toDbFields(data) {
    const dbData = {};
    const fieldMap = {
      id: 'id',

      // Resend domain info
      resendDomainId: 'resend_domain_id',
      domainName: 'domain_name',
      status: 'status', // 'pending', 'verified', 'failed'
      region: 'region',
      dnsRecords: 'dns_records', // JSON array of DNS records

      // Email configuration
      fromEmail: 'from_email',
      fromName: 'from_name',
      replyToEmail: 'reply_to_email',

      // Metadata
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      verifiedAt: 'verified_at'
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
      resendDomainId: dbData.resend_domain_id,
      domainName: dbData.domain_name,
      status: dbData.status,
      region: dbData.region,
      dnsRecords: dbData.dns_records,
      fromEmail: dbData.from_email,
      fromName: dbData.from_name,
      replyToEmail: dbData.reply_to_email,
      isActive: dbData.is_active,
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at,
      verifiedAt: dbData.verified_at
    };
  }

  /**
   * Create a new email domain record
   */
  static async create(domainData) {
    const supabase = getSupabase();

    const dbData = this._toDbFields({
      ...domainData,
      status: domainData.status || 'pending',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const { data, error } = await supabase
      .from('email_domains')
      .insert([dbData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating email domain: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Find email domain by ID
   */
  static async findById(id) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Error finding email domain: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Find email domain by Resend domain ID
   */
  static async findByResendDomainId(resendDomainId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('email_domains')
      .select('*')
      .eq('resend_domain_id', resendDomainId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Error finding email domain: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Find email domain by domain name
   */
  static async findByDomainName(domainName) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('email_domains')
      .select('*')
      .eq('domain_name', domainName.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Error finding email domain: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Get all email domains
   */
  static async findAll() {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('email_domains')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error finding email domains: ${error.message}`);
    }

    return (data || []).map(d => this._toModel(d));
  }

  /**
   * Get active verified domains only
   */
  static async findVerified() {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('email_domains')
      .select('*')
      .eq('status', 'verified')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error finding verified domains: ${error.message}`);
    }

    return (data || []).map(d => this._toModel(d));
  }

  /**
   * Update email domain
   */
  static async update(id, updateData) {
    const supabase = getSupabase();

    const dbData = this._toDbFields({
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    const { data, error } = await supabase
      .from('email_domains')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating email domain: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Update domain status (e.g., after verification)
   */
  static async updateStatus(id, status, dnsRecords = null) {
    const updateData = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (status === 'verified') {
      updateData.verifiedAt = new Date().toISOString();
    }

    if (dnsRecords) {
      updateData.dnsRecords = dnsRecords;
    }

    return this.update(id, updateData);
  }

  /**
   * Update email configuration
   */
  static async updateEmailConfig(id, { fromEmail, fromName, replyToEmail }) {
    return this.update(id, {
      fromEmail,
      fromName,
      replyToEmail
    });
  }

  /**
   * Delete email domain
   */
  static async delete(id) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('email_domains')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error deleting email domain: ${error.message}`);
    }

    return this._toModel(data);
  }

  /**
   * Check if a domain name is already registered
   */
  static async exists(domainName) {
    const domain = await this.findByDomainName(domainName);
    return !!domain;
  }
}

module.exports = EmailDomain;
