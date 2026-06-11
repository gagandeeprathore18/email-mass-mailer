import nodemailer from 'nodemailer';
import { decryptPassword } from './encryption';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SmtpAccountInput {
  host: string;
  port: number;
  username: string;
  encrypted_password?: string;
  password?: string;
}

/**
 * Reusable SMTP transporter service that constructs a Nodemailer transporter.
 */
export function createTransporter(
  smtpAccount: SmtpAccountInput,
  options: { rejectUnauthorized: boolean; pool?: boolean }
) {
  let pass = '';
  if (smtpAccount.password) {
    pass = smtpAccount.password;
  } else if (smtpAccount.encrypted_password) {
    pass = decryptPassword(smtpAccount.encrypted_password);
  }

  return createSmtpTransporter(
    {
      host: smtpAccount.host,
      port: Number(smtpAccount.port),
      user: smtpAccount.username,
      pass: pass,
    },
    options
  );
}

/**
 * Creates a Nodemailer transporter with the specified security configuration.
 */
export function createSmtpTransporter(
  config: SmtpConfig,
  options: { rejectUnauthorized: boolean; pool?: boolean }
) {
  const isSecure = config.port === 465;

  const transportOpts: any = {
    host: config.host,
    port: config.port,
    secure: isSecure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    // Set connection/greeting/socket timeouts to avoid hanging connections
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    // Custom TLS settings
    tls: {
      // Bypasses certificate checks if rejectUnauthorized is false
      rejectUnauthorized: options.rejectUnauthorized,
      // For IP-based SMTP or servers where SNI mismatches the host headers,
      // specifying servername can sometimes help, but in the case of IP addresses
      // we bypass hostname verification entirely if rejectUnauthorized is false.
      servername: config.host,
    },
  };

  if (options.pool) {
    transportOpts.pool = true;
    transportOpts.maxConnections = 3;
    transportOpts.maxMessages = 100;
    transportOpts.rateDelta = 1000;
    transportOpts.rateLimit = 5; // max 5 messages per second to avoid spam throttling
  }

  return nodemailer.createTransport(transportOpts);
}

/**
 * Checks if a given error is a TLS/SSL handshake or certificate validation error.
 */
export function isTlsValidationError(error: any): boolean {
  const code = error?.code || '';
  const message = error?.message || '';

  return (
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    message.includes('self signed certificate') ||
    message.includes('altnames') ||
    message.includes('hostname') ||
    message.includes('certificate') ||
    message.includes('TLS') ||
    message.includes('SSL')
  );
}

/**
 * Verifies the SMTP connection by trying strict TLS first,
 * and falling back to relaxed TLS verification if a TLS-related failure occurs.
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<{
  success: boolean;
  rejectUnauthorized: boolean;
  warning?: string;
}> {
  // 1. Try with strict TLS/SSL validation
  try {
    const transporter = createSmtpTransporter(config, { rejectUnauthorized: true });
    await transporter.verify();
    return { success: true, rejectUnauthorized: true };
  } catch (error: any) {
    console.warn(`Strict SMTP verification failed for ${config.host}:${config.port}:`, error.message);

    // If it's a TLS/SSL validation error, fall back to relaxed validation
    if (isTlsValidationError(error)) {
      try {
        console.log(`Retrying SMTP verification with relaxed TLS for ${config.host}:${config.port}...`);
        const fallbackTransporter = createSmtpTransporter(config, { rejectUnauthorized: false });
        await fallbackTransporter.verify();
        return {
          success: true,
          rejectUnauthorized: false,
          warning: 'SMTP verification succeeded, but required bypassing SSL/TLS certificate verification (Self-signed or mismatched hostname).',
        };
      } catch (fallbackError: any) {
        throw new Error(`SMTP verification failed even after bypassing SSL validation: ${fallbackError.message}`);
      }
    }

    // If it's a credentials or networking error, propagate it directly
    throw error;
  }
}

/**
 * Sends a single mail with dynamic TLS fallback logic.
 */
export async function sendMailWithFallback(
  config: SmtpConfig,
  mailOptions: nodemailer.SendMailOptions
): Promise<any> {
  // 1. Try sending with strict TLS validation
  try {
    const transporter = createSmtpTransporter(config, { rejectUnauthorized: true });
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error: any) {
    if (isTlsValidationError(error)) {
      console.warn(`TLS validation failed during send. Retrying with rejectUnauthorized: false...`);
      const fallbackTransporter = createSmtpTransporter(config, { rejectUnauthorized: false });
      return await fallbackTransporter.sendMail(mailOptions);
    }
    throw error;
  }
}
