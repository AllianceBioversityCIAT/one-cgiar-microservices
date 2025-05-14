import { Test } from '@nestjs/testing';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  const mockLogger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should format HttpException correctly', () => {
    const date = new Date(2023, 1, 1);
    jest.spyOn(global, 'Date').mockImplementation(() => date as any);

    const mockRequest = {
      url: '/test-url',
      method: 'GET',
    } as Request;

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const exception = new HttpException(
      'Test error message',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Test error message',
      path: '/test-url',
      timestamp: date.toISOString(),
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'GET /test-url 400 - Test error message',
      exception.stack,
    );
  });

  it('should use default message when exception message is empty', () => {
    const mockRequest = {
      url: '/test-url',
      method: 'POST',
    } as Request;

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const exception = new HttpException('', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(exception, mockHost as any);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });
});
