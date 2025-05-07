import { HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils } from './utils/response.utils';

@Injectable()
export class AppService {
  getHello() {
    const data = 'Welcome to the File Management Microservice!';

    return ResponseUtils.format({
      data,
      description:
        'The File Management Microservice is running for CGIAR applications.',
      status: HttpStatus.OK,
    });
  }
}
