import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BulkCreateUsersDto,
  BulkCreationResponse,
  UserCreationResult,
  CreateUserDto,
} from '../../dto/bulk-user-registration.dto';
import { EmailNotificationManagementService } from '../notification/notification.service';
import { PasswordGeneratorService } from '../password/password.service';

@Injectable()
export class BulkUserService {
  private readonly logger = new Logger(BulkUserService.name);
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailNotificationManagementService,
    private readonly passwordGenerator: PasswordGeneratorService,
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });

    this.userPoolId = this.configService.get<string>('COGNITO_USER_POOL_ID');
  }

  async bulkCreateUsers(
    bulkCreateUsersDto: BulkCreateUsersDto,
  ): Promise<BulkCreationResponse> {
    const { users } = bulkCreateUsersDto;
    const results: UserCreationResult[] = [];

    let successCount = 0;
    let failedCount = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    this.logger.log(`🚀 Starting bulk creation of ${users.length} users`);

    for (const [index, user] of users.entries()) {
      this.logger.log(
        `📤 Processing ${index + 1}/${users.length}: ${user.email}`,
      );

      const result = await this.createSingleUser(user);
      results.push(result);

      if (result.success) {
        successCount++;

        const emailSent = await this.sendWelcomeEmail(
          user,
          result.tempPassword,
        );
        result.emailSent = emailSent;

        if (emailSent) {
          emailsSent++;
        } else {
          emailsFailed++;
        }
      } else {
        failedCount++;
      }

      await this.sleep(500);
    }

    const response: BulkCreationResponse = {
      totalUsers: users.length,
      successCount,
      failedCount,
      emailsSent,
      emailsFailed,
      results,
    };

    this.logFinalReport(response);
    return response;
  }

  private async createSingleUser(
    user: CreateUserDto,
  ): Promise<UserCreationResult> {
    try {
      const tempPassword = this.passwordGenerator.generateSecurePassword(
        12,
        true,
        true,
      );

      const validation =
        this.passwordGenerator.validateCognitoPassword(tempPassword);
      if (!validation.isValid) {
        throw new Error(
          `Generated password is not valid: ${validation.errors.join(', ')}`,
        );
      }

      const command = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: user.username,
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'given_name', Value: user.firstName },
          { Name: 'family_name', Value: user.lastName },
          { Name: 'email_verified', Value: 'true' },
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS',
      });

      await this.cognitoClient.send(command);

      this.logger.log(`✅ User created in Cognito: ${user.email}`);

      return {
        email: user.email,
        username: user.username,
        success: true,
        tempPassword,
      };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error.name === 'UsernameExistsException') {
        errorMessage = 'User already exists';
        this.logger.warn(`⚠️ User already exists in Cognito: ${user.email}`);
      } else {
        errorMessage = error.message || error.toString();
        this.logger.error(
          `❌ Error creating user ${user.email}: ${errorMessage}`,
        );
      }

      return {
        email: user.email,
        username: user.username,
        success: false,
        error: errorMessage,
      };
    }
  }

  private async sendWelcomeEmail(
    user: CreateUserDto,
    tempPassword: string,
  ): Promise<boolean> {
    try {
      const htmlContent = this.generateWelcomeEmailHTML(user, tempPassword);

      const emailData = {
        from: {
          email: this.configService.get<string>('EMAIL_SENDER'),
          name: 'PRMS Reporting Tool',
        },
        emailBody: {
          subject:
            '🔐 Important: PRMS Account Security Update - Action Required',
          to: user.email,
          cc: '',
          bcc: this.configService.get<string>('TECH_SUPPORT_EMAIL', ''),
          message: {
            text: `PRMS Account Migration - Temporary Password for ${user.firstName}`,
            socketFile: Buffer.from(htmlContent, 'utf-8'),
          },
        },
      };

      this.emailService.sendEmail(emailData);
      this.logger.log(`✅ Email sent for: ${user.email}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Error sending email for ${user.email}: ${error.message}`,
      );
      return false;
    }
  }

  private generateWelcomeEmailHTML(
    user: CreateUserDto,
    tempPassword: string,
  ): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>PRMS Account Migration - Important Security Update</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <style>
        * { font-family: 'Poppins', system-ui; }
        body { line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 50px 20px; color: #000; }
        .header { padding: 20px; padding-bottom: 45px; max-width: 280px; }
        .content { background-color: #fafafa; padding: 40px 70px; border-radius: 5px; box-shadow: 0px 2px 11px 0px #b0c4deb0; text-align: justify; margin-bottom: 50px; font-weight: 400; font-size: 14px; }
        .link { text-decoration: underline; color: #5569dd; }
        .footer { padding-top: 30px; text-align: center; font-size: 13px; color: #666; }
        .footer-link { text-decoration: underline; color: #4b5057; font-weight: 500; font-size: 14px; }
        .fw-600 { font-weight: 600; }
        .password-box { background-color: #e8f0fe; border: 2px solid #5569dd; border-radius: 5px; padding: 20px; margin: 20px 0; text-align: center; }
        .password { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #1a1a1a; letter-spacing: 2px; margin: 10px 0; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; color: #856404; }
        .steps { background-color: #f8f9fa; border-radius: 5px; padding: 20px; margin: 20px 0; }
        .step-item { margin: 10px 0; padding-left: 20px; }
        </style>
    </head>
    <body>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; margin: 0 auto; font-family: 'Poppins', system-ui">
        <tr>
            <td align="center">
            <table width="700" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin: 0 auto; font-family: 'Poppins', system-ui;">
                <tr>
                <td class="header">
                    <img src="https://prms-file-storage.s3.amazonaws.com/email-images/Email_PRMS_Header.svg" alt="PRMS Reporting tool" />
                </td>
                </tr>
                <tr>
                <td class="content">
                    <h2 class="fw-600" style="font-size: 18px">Dear ${user.firstName},</h2>
                    <p>We are writing to inform you about an important security update to your <span class="fw-600">PRMS Reporting Tool</span> account.</p>
                    <p>As part of our ongoing commitment to security and user experience, we have migrated our authentication system to a new, more secure platform. This migration requires all users to set up a new password.</p>
                    <div class="password-box">
                    <p class="fw-600" style="margin: 0;">Your temporary password is:</p>
                    <p class="password">${tempPassword}</p>
                    </div>
                    <div class="warning">
                    <p class="fw-600" style="margin-top: 0;">⚠️ Important Security Notice:</p>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li>This temporary password will expire after your first login</li>
                        <li>You will be required to create a new password immediately</li>
                        <li>Do not share this password with anyone</li>
                    </ul>
                    </div>
                    <div class="steps">
                    <p class="fw-600">Next Steps:</p>
                    <ol style="margin: 0; padding-left: 20px;">
                        <li class="step-item">Go to the <a href="https://prms.ciat.cgiar.org" class="link fw-600">PRMS Reporting Tool</a></li>
                        <li class="step-item">Log in using your email: <span class="fw-600">${user.email}</span></li>
                        <li class="step-item">Enter the temporary password provided above</li>
                        <li class="step-item">Follow the prompts to create your new secure password</li>
                    </ol>
                    </div>
                    <p><span class="fw-600">Password Requirements:</span><br/>Your new password must contain at least:</p>
                    <ul style="margin: 10px 0; padding-left: 30px;">
                    <li>8 characters in length</li>
                    <li>One uppercase letter (A-Z)</li>
                    <li>One lowercase letter (a-z)</li>
                    <li>One number (0-9)</li>
                    <li>One special character (!@#$%^&* etc.)</li>
                    </ul>
                    <p>If you experience any issues during this process, please contact our support team at <a href="mailto:PRMSTechSupport@cgiar.org" class="link fw-600">PRMSTechSupport@cgiar.org</a></p>
                    <p>Thank you for your understanding and cooperation in maintaining the security of your account.</p>
                    <p>Kind regards,<br />The PRMS Team</p>
                </td>
                </tr>
                <tr>
                <td style="padding-top: 50px">
                    <img src="https://prms-file-storage.s3.amazonaws.com/email-images/Email_PRMS_Waves.svg" alt="PRMS Reporting tool" />
                </td>
                </tr>
                <tr>
                <td class="footer">
                    <p>This is an automated security notification. You are receiving this email because you are registered in the PRMS Reporting Tool. For security reasons, this message cannot be replied to.</p>
                    <a href="mailto:PRMSTechSupport@cgiar.org" class="footer-link">PRMSTechSupport@cgiar.org</a>
                </td>
                </tr>
            </table>
            </td>
        </tr>
        </table>
    </body>
    </html>
    `;
  }

  private logFinalReport(response: BulkCreationResponse): void {
    this.logger.log('='.repeat(60));
    this.logger.log('📊 REPORTE FINAL DE CREACIÓN MASIVA');
    this.logger.log('='.repeat(60));
    this.logger.log(`📈 Total usuarios: ${response.totalUsers}`);
    this.logger.log(`✅ Exitosos: ${response.successCount}`);
    this.logger.log(`❌ Fallidos: ${response.failedCount}`);
    this.logger.log(`📧 Emails enviados: ${response.emailsSent}`);
    this.logger.log(`📧 Emails fallidos: ${response.emailsFailed}`);
    this.logger.log('='.repeat(60));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
