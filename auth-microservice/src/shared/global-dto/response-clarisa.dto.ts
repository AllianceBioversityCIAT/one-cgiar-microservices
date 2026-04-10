export class ResponseClarisaDto<T> {
  message: string;
  status: number;
  response: T;
}
