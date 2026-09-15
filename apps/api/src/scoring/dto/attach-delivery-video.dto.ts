import { type AttachDeliveryVideoRequest } from '@acc/types';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AttachDeliveryVideoDto implements AttachDeliveryVideoRequest {
  @IsString()
  @MinLength(1)
  videoPath!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
