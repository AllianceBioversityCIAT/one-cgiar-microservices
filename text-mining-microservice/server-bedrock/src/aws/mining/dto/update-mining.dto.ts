import { PartialType } from '@nestjs/mapped-types';
import { CreateMiningDto } from './create-mining.dto';

export class UpdateMiningDto extends PartialType(CreateMiningDto) {}
