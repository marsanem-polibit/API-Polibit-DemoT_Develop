/**
 * Email Sender Utility
 * Handles sending emails via Resend
 */

const { Resend } = require('resend');
const { EmailLog } = require('../models/supabase');

// Initialize Resend with API key from environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Validate email address format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate email addresses in an array
 */
function validateEmailAddresses(emails) {
  if (!Array.isArray(emails)) {
    return { valid: false, error: 'Email addresses must be an array' };
  }

  for (const email of emails) {
    if (!isValidEmail(email)) {
      return { valid: false, error: `Invalid email address: ${email}` };
    }
  }

  return { valid: true };
}

/**
 * Test Resend connection by sending a test email
 */
async function testConnection(userId, testEmail) {
  if (!testEmail || !isValidEmail(testEmail)) {
    throw new Error('Valid test email address is required');
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not configured');
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL environment variable is not configured');
  }

  try {
    const startTime = Date.now();

    // Send test email using Resend
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [testEmail],
      subject: 'Resend Test Email',
      html: '<p>This is a test email to verify your Resend configuration is working correctly.</p>',
      text: 'This is a test email to verify your Resend configuration is working correctly.'
    });

    if (error) {
      throw new Error(error.message || 'Failed to send test email');
    }

    const responseTime = Date.now() - startTime;

    return {
      connected: true,
      testEmailSent: true,
      responseTime,
      messageId: data.id
    };
  } catch (error) {
    throw new Error(`Resend connection failed: ${error.message}`);
  }
}

/**
 * Send email using Resend
 */
async function sendEmail(userId, emailData) {
  const {
    to,
    cc,
    bcc,
    subject,
    bodyText,
    bodyHtml,
    attachments,
    fromEmail,
    fromName,
    replyTo
  } = emailData;

  // Validate Resend configuration
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not configured');
  }

  if (!process.env.RESEND_FROM_EMAIL && !fromEmail) {
    throw new Error('RESEND_FROM_EMAIL environment variable or fromEmail parameter is required');
  }

  // Validate required fields
  if (!to || !Array.isArray(to) || to.length === 0) {
    throw new Error('At least one recipient email address is required');
  }

  if (!subject) {
    throw new Error('Email subject is required');
  }

  if (!bodyText && !bodyHtml) {
    throw new Error('Email body (text or HTML) is required');
  }

  // Validate email addresses
  const toValidation = validateEmailAddresses(to);
  if (!toValidation.valid) {
    throw new Error(toValidation.error);
  }

  if (cc) {
    const ccValidation = validateEmailAddresses(cc);
    if (!ccValidation.valid) {
      throw new Error(ccValidation.error);
    }
  }

  if (bcc) {
    const bccValidation = validateEmailAddresses(bcc);
    if (!bccValidation.valid) {
      throw new Error(bccValidation.error);
    }
  }

  // Prepare "from" field
  const finalFromEmail = fromEmail || process.env.RESEND_FROM_EMAIL;
  const from = fromName
    ? `${fromName} <${finalFromEmail}>`
    : finalFromEmail;

  // Process attachments for Resend format
  const processedAttachments = attachments ? attachments.map(att => {
    // Resend expects attachments in this format:
    // { filename: string, content: Buffer | string }
    if (att.content && typeof att.content === 'string') {
      // If content is base64 string, convert to Buffer
      return {
        filename: att.filename,
        content: Buffer.from(att.content, 'base64')
      };
    }
    return {
      filename: att.filename,
      content: att.content
    };
  }) : undefined;

  // Prepare email data for Resend
  const emailPayload = {
    from,
    to,
    subject,
    html: bodyHtml || undefined,
    text: bodyText || undefined,
    cc: cc && cc.length > 0 ? cc : undefined,
    bcc: bcc && bcc.length > 0 ? bcc : undefined,
    reply_to: replyTo || undefined,
    attachments: processedAttachments
  };

  try {
    // Send email via Resend
    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    // Log successful send
    await EmailLog.create({
      userId,
      emailSettingsId: null, // Not using EmailSettings anymore
      toAddresses: to,
      ccAddresses: cc || [],
      bccAddresses: bcc || [],
      subject,
      bodyText,
      bodyHtml,
      hasAttachments: !!(attachments && attachments.length > 0),
      attachmentCount: attachments ? attachments.length : 0,
      status: 'sent',
      messageId: data.id,
      sentAt: new Date().toISOString()
    });

    return {
      success: true,
      messageId: data.id,
      to,
      subject,
      sentAt: new Date().toISOString()
    };
  } catch (error) {
    // Log failed attempt
    await EmailLog.create({
      userId,
      emailSettingsId: null,
      toAddresses: to,
      ccAddresses: cc || [],
      bccAddresses: bcc || [],
      subject,
      bodyText,
      bodyHtml,
      hasAttachments: !!(attachments && attachments.length > 0),
      attachmentCount: attachments ? attachments.length : 0,
      status: 'failed',
      errorMessage: error.message
    });

    throw new Error(`Failed to send email: ${error.message}`);
  }
}

module.exports = {
  sendEmail,
  testConnection,
  isValidEmail,
  validateEmailAddresses
};
