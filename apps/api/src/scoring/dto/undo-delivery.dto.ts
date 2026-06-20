import type { UndoDeliveryRequest } from '@acc/types';
import { IsInt, Min } from 'class-validator';

export class UndoDeliveryDto implements UndoDeliveryRequest {
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
