import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EmailConfigDto {
  @ApiProperty({
    description: 'Sender email address for notifications',
    example: 'noreply@prms.cgiar.org',
  })
  @IsEmail()
  @IsNotEmpty()
  sender_email: string;

  @ApiProperty({
    description: 'Display name for the sender',
    example: 'PRMS Team',
  })
  @IsString()
  @IsNotEmpty()
  sender_name: string;

  @ApiProperty({
    description: 'Email subject template with dynamic variables',
    example: '🔐 Welcome to {{appName}} - Account Created',
  })
  @IsString()
  @IsNotEmpty()
  welcome_subject: string;

  @ApiProperty({
    description: 'Application name for display',
    example: 'PRMS Reporting Tool',
  })
  @IsString()
  @IsNotEmpty()
  app_name: string;

  @ApiProperty({
    description: 'Application URL for user access',
    example: 'https://prms.ciat.cgiar.org',
  })
  @IsUrl()
  @IsNotEmpty()
  app_url: string;

  @ApiProperty({
    description: 'Support email for user assistance',
    example: 'support@prms.cgiar.org',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  support_email?: string;

  @ApiProperty({
    description: 'URL to the application logo',
    example: 'https://prms.cgiar.org/assets/logo.png',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  logo_url?: string;

  @ApiProperty({
    description:
      'HTML email template with variables like {{firstName}}, {{tempPassword}}, {{appName}}, etc.',
    example: `<!DOCTYPE html>
              <html>
              <body>
                <div style="max-width: 600px; margin: 0 auto;">
                  <img src="{{logoUrl}}" alt="{{appName}}" style="max-width: 200px;">
                  <h1>Welcome to {{appName}}, {{firstName}}!</h1>
                  <p>Your account has been created successfully.</p>
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
                    <p><strong>Username:</strong> {{username}}</p>
                    <p><strong>Temporary Password:</strong> {{tempPassword}}</p>
                  </div>
                  <p>Access the application: <a href="{{appUrl}}">{{appUrl}}</a></p>
                  <p>Need help? Contact: {{supportEmail}}</p>
                  <hr>
                  <p><small>Sent by {{senderName}}</small></p>
                </div>
              </body>
              </html>`,
  })
  @IsString()
  @IsNotEmpty()
  welcome_html_template: string;

  @ApiProperty({
    description: 'Custom CSS styles for email template (optional)',
    example:
      '.custom-button { background-color: #1976d2; color: white; padding: 10px 20px; }',
    required: false,
  })
  @IsString()
  @IsOptional()
  custom_styles?: string;
}

export class RegisterUserDto {
  @ApiProperty({
    description: 'Username (typically email)',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Email configuration for welcome email',
    type: EmailConfigDto,
  })
  @ValidateNested()
  @Type(() => EmailConfigDto)
  emailConfig: EmailConfigDto;
}
