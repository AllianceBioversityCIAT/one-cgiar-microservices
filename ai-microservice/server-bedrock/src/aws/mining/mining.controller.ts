import { Controller, Post } from '@nestjs/common';
import { MiningService } from './mining.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('mining')
@Controller('mining')
export class MiningController {
  constructor(private readonly miningService: MiningService) {}

  @Post()
  @ApiOperation({ summary: '' })
  @ApiResponse({
    status: 201,
    description: 'Proceso de minería creado exitosamente.',
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  async message() {
    return await this.miningService.create();
  }
}
