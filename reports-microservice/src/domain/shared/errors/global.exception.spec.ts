import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { GlobalExceptions } from './global.exception';

describe('GlobalExceptions', () => {
  let filter: GlobalExceptions;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptions();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = { url: '/test' };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should set status and json from exception', () => {
    const exception = {
      status: HttpStatus.BAD_REQUEST,
      name: 'BadRequestException',
      message: 'Invalid input',
    };

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'BadRequestException',
        status: HttpStatus.BAD_REQUEST,
        errors: 'Invalid input',
        path: '/test',
      }),
    );
    expect(mockResponse.json.mock.calls[0][0].timestamp).toBeDefined();
  });

  it('should use 500 when exception has no status', () => {
    const exception = new Error('Internal');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errors: 'Internal',
      }),
    );
  });
});
