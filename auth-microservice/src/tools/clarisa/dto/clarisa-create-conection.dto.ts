export class MisConfigDto {
  acronym: string;
  environment: string;
}

export class ClarisaCreateConenctionDto {
  sender_mis: MisConfigDto;
  receiver_mis: MisConfigDto;
}

export class ResMisConfigDto {
  id: number;
  name: string;
  acronym: string;
  environment: string;
}

export class ResClarisaValidateConectioDto {
  client_id: string;
  sender_mis: ResMisConfigDto;
  receiver_mis: ResMisConfigDto;
}

export class ResClarisaCreateConectioDto extends ResClarisaValidateConectioDto {
  secret: string;
}