import { Injectable, Logger } from '@nestjs/common';
import { Clarisa } from './clarisa.connection';
import { HttpService } from '@nestjs/axios';
import {
  ClarisaCreateConenctionDto,
  MisConfigDto,
  ResClarisaCreateConectioDto,
  ResClarisaValidateConectioDto,
} from './dto/clarisa-create-conection.dto';
import { ResponseClarisaDto } from '../../shared/global-dto/response-clarisa.dto';
import { ConfigService } from '@nestjs/config';
import { MisMetadataDto } from './dto/mis-medatada.dto';

@Injectable()
export class ClarisaService {
  private readonly connection: Clarisa;
  private readonly misSettings: MisConfigDto = {
    acronym: this.configService.get('CLARISA_MIS'),
    environment: this.configService.get('CLARISA_MIS_ENV'),
  };
  private readonly logger = new Logger(ClarisaService.name);

  constructor(
    private readonly _http: HttpService,
    private readonly configService: ConfigService,
  ) {
    const clarisaLogin = this.configService.get('CLARISA_LOGIN');
    this.logger.debug(`CLARISA Login: ${clarisaLogin}`);
    const clarisaPassword = this.configService.get('CLARISA_PASSWORD');
    this.logger.debug(
      `CLARISA Password: ${clarisaPassword ? '[SET]' : '[NOT SET]'}`,
    );
    this.connection = new Clarisa(
      this._http,
      {
        login: clarisaLogin,
        password: clarisaPassword,
      },
      this.configService,
    );
    this.logger.log(
      `CLARISA service initialized for MIS: ${this.misSettings.acronym} in environment: ${this.misSettings.environment}`,
    );
  }

  /**
   * Validates client credentials against CLARISA
   * @param clientId The client ID
   * @param clientSecret The client secret
   * @returns The validation result with sender MIS information
   */
  async authorization(
    clientId: string,
    clientSecret: string,
  ): Promise<ResponseValidateClarisa<any>> {
    this.logger.log(`Authorizing client ID: ${clientId}`);
    try {
      const validationResult = await this.connection
        .post<ClarisaSecret, ResponseClarisaDto<ResClarisaValidateConectioDto>>(
          'app-secrets/validate',
          {
            client_id: clientId,
            secret: clientSecret,
          },
        )
        .then((res) => this.formatValid<ResClarisaValidateConectioDto>(res))
        .catch((err) => {
          this.logger.error(`Error authorizing client ID: ${clientId}`, err);
          return this.formatValid<ResClarisaValidateConectioDto>(err);
        });

      if (!validationResult.valid || !validationResult.data) {
        return validationResult;
      }

      this.logger.debug(`Validation result:`, validationResult);

      const data = validationResult.data as ResClarisaValidateConectioDto;
      const senderId = data.sender_mis.id;

      this.logger.log(`Getting metadata for MIS ID: ${senderId}`);

      const misMetadata = await this.getMisMetadata(senderId);

      if (!misMetadata || !misMetadata.mis_auth) {
        this.logger.error(
          `Failed to get metadata for MIS ID: ${senderId} or missing mis_auth`,
        );
        return {
          valid: false,
          data: null,
        };
      }

      return {
        valid: true,
        data: {
          ...data,
          sender_mis_metadata: misMetadata,
        },
      };
    } catch (error) {
      this.logger.error(
        `Unexpected error during authorization process: ${error.message}`,
        error.stack,
      );
      return {
        valid: false,
        data: null,
      };
    }
  }

  /**
   * Creates a connection between two MISes
   * @param mis The sender MIS configuration
   * @returns The created connection details
   */
  async createConnection(
    mis: MisConfigDto,
  ): Promise<ResClarisaCreateConectioDto> {
    this.logger.log(
      `Creating connection for sender MIS: ${mis.acronym} in environment: ${mis.environment}`,
    );
    const claConn = await this.connection.post<
      ClarisaCreateConenctionDto,
      ResponseClarisaDto<ResClarisaCreateConectioDto>
    >('app-secrets/create', {
      receiver_mis: this.misSettings,
      sender_mis: mis,
    });
    return this.formatValid(claConn).data;
  }

  /**
   * Gets metadata for a MIS by ID, including authentication details
   * @param misId The MIS ID
   * @returns The MIS metadata with authentication details or null if not found
   */
  async getMisMetadata(misId: number): Promise<MisMetadataDto | null> {
    this.logger.log(`Getting MIS metadata for ID: ${misId}`);
    try {
      const misMetadata = await this.connection.get<MisMetadataDto>(
        `mises/get-metadata/${misId}`,
      );

      if (
        misMetadata &&
        typeof misMetadata === 'object' &&
        'id' in misMetadata
      ) {
        return misMetadata;
      } else {
        this.logger.error('Invalid MIS metadata response structure');
        return null;
      }
    } catch (err) {
      this.logger.error(`Error getting MIS metadata for ID: ${misId}`, err);
      return null;
    }
  }

  /**
   * Formats the response from CLARISA to a standard format
   * @param data The response data
   * @returns The formatted response
   */
  formatValid<T>(data: ResponseClarisaDto<T>): ResponseValidateClarisa<T> {
    if (data.status >= 200 && data.status < 300) {
      return {
        data: data.response,
        valid: true,
      };
    }
    return {
      data: null,
      valid: false,
    };
  }
}

class ClarisaSecret {
  client_id: string;
  secret: string;
}

export class ResponseValidateClarisa<T> {
  data: T;
  valid: boolean;
}
