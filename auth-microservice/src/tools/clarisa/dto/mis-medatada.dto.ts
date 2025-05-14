export class MisAuthDto {
  id: number;
  mis_id: number;
  auth_url: string;
  cognito_client_id: string;
  cognito_client_secret: string;
}

export class MisMetadataDto {
  id: number;
  name: string;
  acronym: string;
  main_contact_point_id: number;
  environment_id: number;
  mis_auth?: MisAuthDto;
}
