import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ClarisaService } from '../../tools/clarisa/clarisa.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let clarisaService: jest.Mocked<ClarisaService>;

  beforeEach(() => {
    clarisaService = {
      authorization: jest.fn(),
    } as unknown as jest.Mocked<ClarisaService>;
    guard = new AuthGuard(clarisaService);
  });

  const createMockContext = (data: any): ExecutionContext =>
    ({
      switchToRpc: () => ({
        getData: () => data,
      }),
    }) as unknown as ExecutionContext;

  it('should return false when credentials are missing', async () => {
    const ctx = createMockContext({});

    const result = await guard.canActivate(ctx);

    expect(result).toBe(false);
    expect(clarisaService.authorization).not.toHaveBeenCalled();
  });

  it('should return true when credentials are valid', async () => {
    clarisaService.authorization.mockResolvedValueOnce({
      valid: true,
      data: {},
    } as any);
    const ctx = createMockContext({
      credentials: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const result = await guard.canActivate(ctx);

    expect(clarisaService.authorization).toHaveBeenCalledWith('u', 'p');
    expect(result).toBe(true);
  });

  it('should return false when credentials are invalid', async () => {
    clarisaService.authorization.mockResolvedValueOnce({
      valid: false,
      data: null,
    } as any);
    const ctx = createMockContext({
      credentials: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  it('should return false when credentials JSON is invalid', async () => {
    const ctx = createMockContext({
      credentials: 'not-valid-json',
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(false);
    expect(clarisaService.authorization).not.toHaveBeenCalled();
  });

  it('should return false when authorization throws', async () => {
    clarisaService.authorization.mockRejectedValueOnce(new Error('Network'));
    const ctx = createMockContext({
      credentials: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(false);
  });
});
