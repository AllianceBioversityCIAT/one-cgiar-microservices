import { Injectable, Logger } from '@nestjs/common';
import { EmailConfigDto, RegisterUserDto } from '../../dto/register-user.dto';
import { EmailNotificationManagementService } from '../notification/notification.service';

export interface EmailTemplateVariables {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  tempPassword: string;
  appName: string;
  appUrl: string;
  supportEmail: string;
  logoUrl: string;
  senderName: string;
}

@Injectable()
export class DynamicEmailService {
  private readonly logger = new Logger(DynamicEmailService.name);

  constructor(
    private readonly emailService: EmailNotificationManagementService,
  ) {}

  /**
   * Processes the HTML template by replacing dynamic variables
   */
  private processTemplate(
    template: string,
    variables: EmailTemplateVariables,
  ): string {
    let processedTemplate = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedTemplate = processedTemplate.replace(regex, value || '');
    });

    const unprocessedVars = processedTemplate.match(/{{\w+}}/g);
    if (unprocessedVars) {
      this.logger.warn(
        `Unprocessed variables found: ${unprocessedVars.join(', ')}`,
      );
    }

    return processedTemplate;
  }

  /**
   * Sends welcome email using the current RabbitMQ notification system
   */
  async sendWelcomeEmail(
    user: RegisterUserDto,
    tempPassword: string,
    emailConfig: EmailConfigDto,
  ): Promise<boolean> {
    try {
      const templateVariables: EmailTemplateVariables = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        tempPassword: tempPassword,
        appName: emailConfig.app_name,
        appUrl: emailConfig.app_url,
        supportEmail: emailConfig.support_email || emailConfig.sender_email,
        logoUrl: emailConfig.logo_url || '',
        senderName: emailConfig.sender_name,
      };

      const processedHtml = this.processTemplate(
        emailConfig.welcome_html_template,
        templateVariables,
      );

      const processedSubject = this.processTemplate(
        emailConfig.welcome_subject,
        templateVariables,
      );

      const emailData = {
        from: {
          email: emailConfig.sender_email,
          name: emailConfig.sender_name,
        },
        emailBody: {
          subject: processedSubject,
          to: user.email,
          cc: '',
          bcc: emailConfig.support_email || '',
          message: {
            text: `Welcome to ${emailConfig.app_name} - Account Created for ${user.firstName}`,
            socketFile: Buffer.from(processedHtml, 'utf-8'),
          },
        },
      };

      this.emailService.sendEmail(emailData);

      this.logger.log(
        `✅ Welcome email queued for: ${user.email} from ${emailConfig.sender_email}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Error sending welcome email to ${user.email}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Validates that the email configuration is complete
   */
  validateEmailConfig(emailConfig: EmailConfigDto): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!emailConfig.sender_email) {
      errors.push('sender_email is required');
    }
    if (!emailConfig.sender_name) {
      errors.push('sender_name is required');
    }
    if (!emailConfig.welcome_subject) {
      errors.push('welcome_subject is required');
    }
    if (!emailConfig.welcome_html_template) {
      errors.push('welcome_html_template is required');
    }
    if (!emailConfig.app_name) {
      errors.push('app_name is required');
    }
    if (!emailConfig.app_url) {
      errors.push('app_url is required');
    }

    if (
      emailConfig.welcome_html_template &&
      !emailConfig.welcome_html_template.includes('{{tempPassword}}')
    ) {
      errors.push(
        'welcome_html_template must contain the {{tempPassword}} variable',
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      emailConfig.sender_email &&
      !emailRegex.test(emailConfig.sender_email)
    ) {
      errors.push('sender_email must have valid format');
    }

    if (
      emailConfig.support_email &&
      !emailRegex.test(emailConfig.support_email)
    ) {
      errors.push('support_email must have valid format');
    }

    try {
      new URL(emailConfig.app_url);
    } catch {
      errors.push('app_url must be a valid URL');
    }

    if (emailConfig.logo_url) {
      try {
        new URL(emailConfig.logo_url);
      } catch {
        errors.push('logo_url must be a valid URL');
      }
    }

    if (
      emailConfig.welcome_html_template &&
      emailConfig.welcome_html_template.includes('<script')
    ) {
      errors.push('welcome_html_template must not contain <script> tags');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets email template statistics
   */
  getEmailStats(templateContent: string): {
    variableCount: number;
    variables: string[];
    templateSize: number;
  } {
    const variables = templateContent.match(/{{\w+}}/g) || [];
    const uniqueVariables = [
      ...new Set(variables.map((v) => v.replace(/[{}]/g, ''))),
    ];

    return {
      variableCount: uniqueVariables.length,
      variables: uniqueVariables,
      templateSize: templateContent.length,
    };
  }

  /**
   * Generates a default HTML template if needed
   */
  generateDefaultTemplate(): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to {{appName}}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .password-box { 
                background-color: #e8f0fe; 
                border: 2px solid #1976d2; 
                border-radius: 5px; 
                padding: 15px; 
                margin: 20px 0; 
                text-align: center; 
            }
            .password { 
                font-family: monospace; 
                font-size: 18px; 
                font-weight: bold; 
                color: #1976d2; 
            }
            .footer { 
                background-color: #f4f4f4; 
                padding: 15px; 
                text-align: center; 
                font-size: 12px; 
                color: #666; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to {{appName}}</h1>
            </div>
            <div class="content">
                <h2>Hello {{firstName}},</h2>
                <p>Your account has been created successfully! Here are your login credentials:</p>
                
                <p><strong>Username:</strong> {{username}}</p>
                
                <div class="password-box">
                    <p><strong>Temporary Password:</strong></p>
                    <div class="password">{{tempPassword}}</div>
                </div>
                
                <p><strong>Important:</strong> This is a temporary password. You will be required to change it on your first login.</p>
                
                <p>You can access the application at: <a href="{{appUrl}}">{{appUrl}}</a></p>
                
                <p>If you need assistance, please contact our support team at: {{supportEmail}}</p>
                
                <p>Best regards,<br>The {{appName}} Team</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>`;
  }
}
