import { Test, TestingModule } from '@nestjs/testing';
import { DynamicEmailService } from './dynamic-email.service';
import { EmailNotificationManagementService } from '../notification/notification.service';
import { EmailConfigDto, RegisterUserDto } from '../../dto/register-user.dto';

describe('DynamicEmailService', () => {
  let service: DynamicEmailService;
  let emailNotificationService: jest.Mocked<EmailNotificationManagementService>;

  const mockEmailConfig: EmailConfigDto = {
    sender_email: 'noreply@test.cgiar.org',
    sender_name: 'Test Team',
    welcome_subject: 'Welcome to {{appName}}, {{firstName}}!',
    app_name: 'Test Application',
    app_url: 'https://test.cgiar.org',
    support_email: 'support@test.cgiar.org',
    logo_url: 'https://test.cgiar.org/logo.png',
    welcome_html_template:
      '<html><body><h1>Welcome {{firstName}} {{lastName}}!</h1><p>Username: {{username}}</p><p>Password: {{tempPassword}}</p><p><a href="{{appUrl}}">Login</a></p><p>Support: {{supportEmail}}</p></body></html>',
  };

  const mockUser: RegisterUserDto = {
    username: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    email: 'test@example.com',
    emailConfig: mockEmailConfig,
  };

  const mockTempPassword = 'TempPass123!';

  beforeEach(async () => {
    const mockEmailNotificationService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicEmailService,
        {
          provide: EmailNotificationManagementService,
          useValue: mockEmailNotificationService,
        },
      ],
    }).compile();

    service = module.get<DynamicEmailService>(DynamicEmailService);
    emailNotificationService = module.get(EmailNotificationManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      emailNotificationService.sendEmail.mockReturnValue(undefined);

      const result = await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        mockEmailConfig,
      );

      expect(result).toBe(true);
      expect(emailNotificationService.sendEmail).toHaveBeenCalledWith({
        from: {
          email: mockEmailConfig.sender_email,
          name: mockEmailConfig.sender_name,
        },
        emailBody: {
          subject: 'Welcome to Test Application, John!',
          to: mockUser.email,
          cc: '',
          bcc: mockEmailConfig.support_email,
          message: {
            text: 'Welcome to Test Application - Account Created for John',
            socketFile: expect.any(Buffer),
          },
        },
      });
    });

    it('should process template variables correctly', async () => {
      emailNotificationService.sendEmail.mockReturnValue(undefined);

      await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        mockEmailConfig,
      );

      const callArgs = emailNotificationService.sendEmail.mock.calls[0][0];
      const emailBody = callArgs.emailBody.message.socketFile.toString('utf-8');

      expect(emailBody).toContain('Welcome John Doe!');
      expect(emailBody).toContain('Username: test@example.com');
      expect(emailBody).toContain('Password: TempPass123!');
      expect(emailBody).toContain('https://test.cgiar.org');
      expect(emailBody).toContain('Support: support@test.cgiar.org');
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalEmailConfig: EmailConfigDto = {
        sender_email: 'noreply@simple.com',
        sender_name: 'Simple App',
        welcome_subject: 'Welcome {{firstName}}!',
        app_name: 'Simple App',
        app_url: 'https://simple.com',
        welcome_html_template:
          '<html><body><h1>Welcome {{firstName}}!</h1><p>Password: {{tempPassword}}</p></body></html>',
      };

      emailNotificationService.sendEmail.mockReturnValue(undefined);

      const result = await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        minimalEmailConfig,
      );

      expect(result).toBe(true);
      const callArgs = emailNotificationService.sendEmail.mock.calls[0][0];
      expect(callArgs.emailBody.bcc).toBe('');
      expect(callArgs.from.email).toBe('noreply@simple.com');
    });

    it('should use sender_email as fallback for support_email', async () => {
      const configWithoutSupport: EmailConfigDto = {
        ...mockEmailConfig,
        support_email: undefined,
      };

      emailNotificationService.sendEmail.mockReturnValue(undefined);

      await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        configWithoutSupport,
      );

      const callArgs = emailNotificationService.sendEmail.mock.calls[0][0];
      const emailBody = callArgs.emailBody.message.socketFile.toString('utf-8');

      expect(emailBody).toContain('Support: noreply@test.cgiar.org');
      expect(callArgs.emailBody.bcc).toBe('');
    });

    it('should handle email sending failure', async () => {
      emailNotificationService.sendEmail.mockImplementation(() => {
        throw new Error('RabbitMQ connection failed');
      });

      const result = await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        mockEmailConfig,
      );

      expect(result).toBe(false);
      expect(emailNotificationService.sendEmail).toHaveBeenCalled();
    });

    it('should warn about unprocessed variables', async () => {
      const templateWithUnknownVar: EmailConfigDto = {
        ...mockEmailConfig,
        welcome_html_template:
          '<html><body><h1>Welcome {{firstName}}!</h1><p>Unknown: {{unknownVariable}}</p></body></html>',
      };

      const loggerWarnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation();
      emailNotificationService.sendEmail.mockReturnValue(undefined);

      await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        templateWithUnknownVar,
      );

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Unprocessed variables found: {{unknownVariable}}',
      );

      loggerWarnSpy.mockRestore();
    });

    it('should handle complex template with all variables', async () => {
      const complexTemplate: EmailConfigDto = {
        sender_email: 'complex@test.cgiar.org',
        sender_name: 'Complex Team',
        welcome_subject:
          '🔐 {{firstName}} {{lastName}} - Welcome to {{appName}}!',
        app_name: 'Complex CGIAR Application',
        app_url: 'https://complex.cgiar.org',
        support_email: 'support@complex.cgiar.org',
        logo_url: 'https://complex.cgiar.org/logo.png',
        welcome_html_template: `
          <html>
          <body>
            <img src="{{logoUrl}}" alt="{{appName}}">
            <h1>Welcome {{firstName}} {{lastName}}!</h1>
            <p>Email: {{email}}</p>
            <p>Username: {{username}}</p>
            <p>Password: {{tempPassword}}</p>
            <p>App: {{appName}}</p>
            <p>URL: {{appUrl}}</p>
            <p>Support: {{supportEmail}}</p>
            <p>From: {{senderName}}</p>
          </body>
          </html>
        `,
      };

      emailNotificationService.sendEmail.mockReturnValue(undefined);

      const result = await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        complexTemplate,
      );

      expect(result).toBe(true);
      const callArgs = emailNotificationService.sendEmail.mock.calls[0][0];
      const emailBody = callArgs.emailBody.message.socketFile.toString('utf-8');
      const subject = callArgs.emailBody.subject;

      expect(subject).toBe(
        '🔐 John Doe - Welcome to Complex CGIAR Application!',
      );
      expect(emailBody).toContain('https://complex.cgiar.org/logo.png');
      expect(emailBody).toContain('Welcome John Doe!');
      expect(emailBody).toContain('Email: test@example.com');
      expect(emailBody).toContain('From: Complex Team');
    });
  });

  describe('validateEmailConfig', () => {
    it('should validate complete email configuration', () => {
      const result = service.validateEmailConfig(mockEmailConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const incompleteConfig = {
        sender_email: 'test@example.com',
        // Missing other required fields
      } as EmailConfigDto;

      const result = service.validateEmailConfig(incompleteConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sender_name is required');
      expect(result.errors).toContain('welcome_subject is required');
      expect(result.errors).toContain('welcome_html_template is required');
      expect(result.errors).toContain('app_name is required');
      expect(result.errors).toContain('app_url is required');
    });

    it('should detect missing tempPassword variable in template', () => {
      const configWithoutPassword: EmailConfigDto = {
        ...mockEmailConfig,
        welcome_html_template:
          '<html><body><h1>Welcome {{firstName}}!</h1></body></html>',
      };

      const result = service.validateEmailConfig(configWithoutPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'welcome_html_template must contain the {{tempPassword}} variable',
      );
    });

    it('should detect invalid email format', () => {
      const configWithInvalidEmail: EmailConfigDto = {
        ...mockEmailConfig,
        sender_email: 'invalid-email',
        support_email: 'also-invalid',
      };

      const result = service.validateEmailConfig(configWithInvalidEmail);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sender_email must have valid format');
      expect(result.errors).toContain(
        'support_email must have valid format',
      );
    });

    it('should detect invalid URL format', () => {
      const configWithInvalidUrls: EmailConfigDto = {
        ...mockEmailConfig,
        app_url: 'invalid-url',
        logo_url: 'also-invalid-url',
      };

      const result = service.validateEmailConfig(configWithInvalidUrls);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('app_url must be a valid URL');
      expect(result.errors).toContain('logo_url must be a valid URL');
    });

    it('should detect script tags for XSS prevention', () => {
      const configWithScript: EmailConfigDto = {
        ...mockEmailConfig,
        welcome_html_template:
          '<html><body><script>alert("xss")</script><h1>Welcome {{firstName}}!</h1><p>Password: {{tempPassword}}</p></body></html>',
      };

      const result = service.validateEmailConfig(configWithScript);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'welcome_html_template must not contain <script> tags',
      );
    });

    it('should validate optional fields only when present', () => {
      const configWithOptionalFields: EmailConfigDto = {
        sender_email: 'test@valid.com',
        sender_name: 'Test Name',
        welcome_subject: 'Welcome',
        app_name: 'Test App',
        app_url: 'https://valid.com',
        welcome_html_template:
          '<html><body><h1>Welcome!</h1><p>{{tempPassword}}</p></body></html>',
        // Optional fields omitted
      };

      const result = service.validateEmailConfig(configWithOptionalFields);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle multiple validation errors', () => {
      const badConfig: EmailConfigDto = {
        sender_email: 'invalid-email',
        sender_name: '',
        welcome_subject: '',
        app_name: '',
        app_url: 'invalid-url',
        welcome_html_template: '<script>alert("xss")</script>No password var',
        support_email: 'bad-email',
        logo_url: 'bad-url',
      };

      const result = service.validateEmailConfig(badConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
      expect(result.errors).toContain('sender_name is required');
      expect(result.errors).toContain('welcome_subject is required');
      expect(result.errors).toContain('app_name is required');
      expect(result.errors).toContain('sender_email must have valid format');
      expect(result.errors).toContain('app_url must be a valid URL');
      expect(result.errors).toContain(
        'welcome_html_template must contain the {{tempPassword}} variable',
      );
      expect(result.errors).toContain(
        'welcome_html_template must not contain <script> tags',
      );
    });
  });

  describe('getEmailStats', () => {
    it('should count template variables correctly', () => {
      const template =
        '<html><body><h1>Welcome {{firstName}} {{lastName}}!</h1><p>Password: {{tempPassword}}</p><p>App: {{appName}}</p></body></html>';

      const result = service.getEmailStats(template);

      expect(result.variableCount).toBe(4);
      expect(result.variables).toContain('firstName');
      expect(result.variables).toContain('lastName');
      expect(result.variables).toContain('tempPassword');
      expect(result.variables).toContain('appName');
      expect(result.templateSize).toBe(template.length);
    });

    it('should handle template with no variables', () => {
      const template = '<html><body><h1>Static content</h1></body></html>';

      const result = service.getEmailStats(template);

      expect(result.variableCount).toBe(0);
      expect(result.variables).toEqual([]);
      expect(result.templateSize).toBe(template.length);
    });

    it('should handle duplicate variables', () => {
      const template =
        '<html><body><h1>{{firstName}}</h1><p>Hello again {{firstName}}!</p></body></html>';

      const result = service.getEmailStats(template);

      expect(result.variableCount).toBe(1);
      expect(result.variables).toEqual(['firstName']);
    });

    it('should handle complex template with many variables', () => {
      const complexTemplate = `
        <html>
        <body>
          <h1>{{firstName}} {{lastName}}</h1>
          <p>Email: {{email}}</p>
          <p>Username: {{username}}</p>
          <p>Password: {{tempPassword}}</p>
          <p>App: {{appName}}</p>
          <p>URL: {{appUrl}}</p>
          <p>Support: {{supportEmail}}</p>
          <p>Logo: {{logoUrl}}</p>
          <p>Sender: {{senderName}}</p>
        </body>
        </html>
      `;

      const result = service.getEmailStats(complexTemplate);

      expect(result.variableCount).toBe(10);
      expect(result.variables).toEqual([
        'firstName',
        'lastName',
        'email',
        'username',
        'tempPassword',
        'appName',
        'appUrl',
        'supportEmail',
        'logoUrl',
        'senderName',
      ]);
    });
  });

  describe('generateDefaultTemplate', () => {
    it('should generate default template with app name and URL', () => {
      const appName = 'Test Application';
      const appUrl = 'https://test.example.com';

      const result = service.generateDefaultTemplate(appName, appUrl);

      expect(result).toContain('{{firstName}}');
      expect(result).toContain('{{tempPassword}}');
      expect(result).toContain('{{appName}}');
      expect(result).toContain('{{appUrl}}');
      expect(result).toContain('{{username}}');
      expect(result).toContain('{{supportEmail}}');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('</html>');
    });

    it('should generate valid HTML structure', () => {
      const result = service.generateDefaultTemplate('App', 'https://app.com');

      expect(result).toMatch(/<html[^>]*>/);
      expect(result).toMatch(/<head[^>]*>/);
      expect(result).toMatch(/<body[^>]*>/);
      expect(result).toMatch(/<\/body>/);
      expect(result).toMatch(/<\/html>/);
      expect(result).toContain('<style>');
    });

    it('should include all essential template variables', () => {
      const result = service.generateDefaultTemplate(
        'Test',
        'https://test.com',
      );

      const essentialVars = [
        '{{firstName}}',
        '{{username}}',
        '{{tempPassword}}',
        '{{appUrl}}',
        '{{supportEmail}}',
        '{{appName}}',
      ];

      essentialVars.forEach((variable) => {
        expect(result).toContain(variable);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty strings in user data', async () => {
      const userWithEmptyData: RegisterUserDto = {
        ...mockUser,
        firstName: '',
        lastName: '',
      };

      emailNotificationService.sendEmail.mockReturnValue(undefined);

      const result = await service.sendWelcomeEmail(
        userWithEmptyData,
        mockTempPassword,
        mockEmailConfig,
      );

      expect(result).toBe(true);
      const callArgs = emailNotificationService.sendEmail.mock.calls[0][0];
      const emailBody = callArgs.emailBody.message.socketFile.toString('utf-8');
      expect(emailBody).toContain('Welcome  !'); // Empty firstName and lastName
    });

    it('should handle null/undefined values in template variables', async () => {
      const configWithUndefinedOptionals: EmailConfigDto = {
        ...mockEmailConfig,
        support_email: undefined,
        logo_url: undefined,
        welcome_html_template:
          '<html><body><h1>Welcome {{firstName}}!</h1><p>Logo: {{logoUrl}}</p><p>Support: {{supportEmail}}</p><p>Password: {{tempPassword}}</p></body></html>',
      };

      emailNotificationService.sendEmail.mockReturnValue(undefined);

      const result = await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        configWithUndefinedOptionals,
      );

      expect(result).toBe(true);
      const callArgs = emailNotificationService.sendEmail.mock.calls[0][0];
      const emailBody = callArgs.emailBody.message.socketFile.toString('utf-8');
      expect(emailBody).toContain('Logo: '); // Empty logoUrl
      expect(emailBody).toContain('Support: noreply@test.cgiar.org'); // Fallback to sender_email
    });

    it('should handle very large templates', () => {
      const largeTemplate =
        '<html><body>' +
        'Large content '.repeat(1000) +
        '{{tempPassword}}</body></html>';
      const configWithLargeTemplate: EmailConfigDto = {
        ...mockEmailConfig,
        welcome_html_template: largeTemplate,
      };

      const result = service.validateEmailConfig(configWithLargeTemplate);

      expect(result.isValid).toBe(true);

      const stats = service.getEmailStats(largeTemplate);
      expect(stats.templateSize).toBeGreaterThan(10000);
    });

    it('should handle special characters in template variables', async () => {
      const userWithSpecialChars: RegisterUserDto = {
        ...mockUser,
        firstName: 'José María',
        lastName: 'García-Pérez',
        username: 'josé.garcía@example.com',
        email: 'josé.garcía@example.com',
      };

      emailNotificationService.sendEmail.mockReturnValue(undefined);

      const result = await service.sendWelcomeEmail(
        userWithSpecialChars,
        'SpecialPass123!@#',
        mockEmailConfig,
      );

      expect(result).toBe(true);
      const callArgs = emailNotificationService.sendEmail.mock.calls[0][0];
      const emailBody = callArgs.emailBody.message.socketFile.toString('utf-8');
      expect(emailBody).toContain('José María');
      expect(emailBody).toContain('García-Pérez');
      expect(emailBody).toContain('SpecialPass123!@#');
    });

    it('should handle email service throwing unexpected errors', async () => {
      const unexpectedError = new TypeError('Unexpected error type');
      emailNotificationService.sendEmail.mockImplementation(() => {
        throw unexpectedError;
      });

      const result = await service.sendWelcomeEmail(
        mockUser,
        mockTempPassword,
        mockEmailConfig,
      );

      expect(result).toBe(false);
    });

    it('should handle malformed HTML in templates gracefully', () => {
      const malformedConfig: EmailConfigDto = {
        ...mockEmailConfig,
        welcome_html_template:
          '<html><body><h1>Welcome {{firstName}}<p>Missing closing tag and {{tempPassword}}</body>',
      };

      const result = service.validateEmailConfig(malformedConfig);

      expect(result.isValid).toBe(true); // Only validates business rules, not HTML syntax
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent email sending', async () => {
      const users = Array.from({ length: 5 }, (_, i) => ({
        ...mockUser,
        username: `user${i}@example.com`,
        email: `user${i}@example.com`,
        firstName: `User${i}`,
      }));

      emailNotificationService.sendEmail.mockReturnValue(undefined);

      const promises = users.map((user) =>
        service.sendWelcomeEmail(user, mockTempPassword, mockEmailConfig),
      );

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true, true, true]);
      expect(emailNotificationService.sendEmail).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed success and failure in concurrent operations', async () => {
      emailNotificationService.sendEmail
        .mockReturnValueOnce(undefined)
        .mockImplementationOnce(() => {
          throw new Error('Failed');
        })
        .mockReturnValueOnce(undefined);

      const promises = [
        service.sendWelcomeEmail(mockUser, mockTempPassword, mockEmailConfig),
        service.sendWelcomeEmail(mockUser, mockTempPassword, mockEmailConfig),
        service.sendWelcomeEmail(mockUser, mockTempPassword, mockEmailConfig),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([true, false, true]);
    });
  });
});
