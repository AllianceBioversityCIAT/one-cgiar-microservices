import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProviderAuthDto } from './dto/provider-auth.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    authenticateWithProvider: jest.fn(),
    validateAuthorizationCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('loginWithProvider', () => {
    it('should call authenticateWithProvider with correct parameters', async () => {
      const providerAuthDto: ProviderAuthDto = {
        misId: '123',
        provider: 'CGIAR-AzureAD',
      };
      const expectedResult = { authUrl: 'https://example.com/auth' };

      mockAuthService.authenticateWithProvider.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.loginWithProvider(providerAuthDto);

      expect(authService.authenticateWithProvider).toHaveBeenCalledWith(
        providerAuthDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('validateAuthorizationCode', () => {
    it('should call validateAuthorizationCode with correct parameters', async () => {
      const validateCodeDto: ValidateCodeDto = {
        misId: '123',
        code: 'test-auth-code',
      };
      const expectedResult = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      mockAuthService.validateAuthorizationCode.mockResolvedValue(
        expectedResult,
      );

      const result =
        await controller.validateAuthorizationCode(validateCodeDto);

      expect(authService.validateAuthorizationCode).toHaveBeenCalledWith(
        validateCodeDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
