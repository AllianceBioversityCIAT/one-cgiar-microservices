import { ApiProperty } from '@nestjs/swagger';
import { AuthorizationDto } from './auth.dto';
import { ResClarisaValidateConectioDto } from '../../tools/clarisa/dtos/clarisa-create-conection.dto';

class EmailBodyMessage {
  @ApiProperty()
  text?: string;
  @ApiProperty()
  socketFile?: Buffer;
  @ApiProperty({ required: false })
  file?: Buffer;
}

class EmailBody {
  @ApiProperty()
  subject: string;
  @ApiProperty()
  to: string;
  @ApiProperty()
  cc?: string;
  @ApiProperty()
  bcc?: string;
  @ApiProperty()
  message: EmailBodyMessage;
}

class FromBody {
  @ApiProperty()
  email: string;
  @ApiProperty()
  name?: string;
}

export class ConfigMessageDto {
  @ApiProperty()
  from?: FromBody;
  @ApiProperty()
  emailBody: EmailBody;
  @ApiProperty({ required: false })
  environment?: string;
  @ApiProperty({ required: false })
  sender?: ResClarisaValidateConectioDto;
}

export class ConfigMessageSocketDto {
  public auth: AuthorizationDto;
  public data: ConfigMessageDto;
  public application: ResClarisaValidateConectioDto;
}
