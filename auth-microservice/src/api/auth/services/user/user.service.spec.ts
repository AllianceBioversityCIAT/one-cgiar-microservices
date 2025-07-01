import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserService, ADUser } from './user.service';
import { Client } from 'ldapts';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';

jest.mock('ldapts');

describe('UserService', () => {
  let service: UserService;
  let configService: ConfigService;
  let mockClient: jest.Mocked<Client>;
  let loggerSpy: jest.SpyInstance;

  const mockConfig = {
    AD_URL: 'ldap://test-domain.com:389',
    AD_BASEDN: 'DC=test,DC=domain,DC=com',
    AD_DOMAIN: 'TESTDOMAIN',
    AD_USERNAME: 'testuser',
    AD_PASSWORD: 'testpassword',
  };

  const mockSearchEntry = {
    dn: 'CN=John Doe,OU=Users,DC=test,DC=domain,DC=com',
    cn: ['John Doe'],
    displayName: ['John Doe'],
    mail: ['john.doe@test.com'],
    sAMAccountName: ['jdoe'],
    givenName: ['John'],
    sn: ['Doe'],
    userPrincipalName: ['john.doe@test.domain.com'],
  };

  beforeEach(async () => {
    mockClient = {
      bind: jest.fn(),
      search: jest.fn(),
      unbind: jest.fn(),
    } as any;

    (Client as jest.MockedClass<typeof Client>).mockImplementation(
      () => mockClient,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    configService = module.get<ConfigService>(ConfigService);
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('should return empty array for invalid query', async () => {
      expect(await service.searchUsers('')).toEqual([]);
      expect(await service.searchUsers(' ')).toEqual([]);
      expect(await service.searchUsers('a')).toEqual([]);
    });

    it('should search and return users', async () => {
      mockClient.bind.mockResolvedValue(undefined);
      mockClient.search.mockResolvedValue({
        searchEntries: [mockSearchEntry],
        searchReferences: [],
      });
      mockClient.unbind.mockResolvedValue(undefined);

      const result = await service.searchUsers('john');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        cn: 'John Doe',
        displayName: 'John Doe',
        mail: 'john.doe@test.com',
        sAMAccountName: 'jdoe',
        givenName: 'John',
        sn: 'Doe',
        userPrincipalName: 'john.doe@test.domain.com',
      });
      expect(mockClient.bind).toHaveBeenCalled();
      expect(mockClient.search).toHaveBeenCalled();
      expect(mockClient.unbind).toHaveBeenCalled();
    });

    it('should handle LDAP errors', async () => {
      mockClient.bind.mockRejectedValue(new Error('fail'));
      await expect(service.searchUsers('john')).rejects.toThrow();
      expect(mockClient.unbind).toHaveBeenCalled();
    });
  });

  describe('getUserDetails', () => {
    it('should return user details if found', async () => {
      mockClient.bind.mockResolvedValue(undefined);
      mockClient.search.mockResolvedValue({
        searchEntries: [mockSearchEntry],
        searchReferences: [],
      });
      mockClient.unbind.mockResolvedValue(undefined);

      const result = await service.getUserDetails('jdoe');
      expect(result).toMatchObject({
        cn: 'John Doe',
        displayName: 'John Doe',
        mail: 'john.doe@test.com',
        sAMAccountName: 'jdoe',
        givenName: 'John',
        sn: 'Doe',
        userPrincipalName: 'john.doe@test.domain.com',
      });
    });

    it('should return null if user not found', async () => {
      mockClient.bind.mockResolvedValue(undefined);
      mockClient.search.mockResolvedValue({
        searchEntries: [],
        searchReferences: [],
      });
      mockClient.unbind.mockResolvedValue(undefined);

      const result = await service.getUserDetails('no-user');
      expect(result).toBeNull();
    });

    it('should handle LDAP errors', async () => {
      mockClient.bind.mockRejectedValue(new Error('fail'));
      await expect(service.getUserDetails('jdoe')).rejects.toThrow();
      expect(mockClient.unbind).toHaveBeenCalled();
    });
  });
});
