import { type SetDeliveryShotPlacementRequest } from '@acc/types';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class SetDeliveryShotPlacementDto implements SetDeliveryShotPlacementRequest {
  @IsOptional()
  @IsString()
  deliveryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @IsOptional()
  @ValidateIf((o: SetDeliveryShotPlacementDto) => o.shotX != null)
  @IsNumber()
  @Min(-1)
  @Max(1)
  shotX!: number | null;

  @IsOptional()
  @ValidateIf((o: SetDeliveryShotPlacementDto) => o.shotY != null)
  @IsNumber()
  @Min(-1)
  @Max(1)
  shotY!: number | null;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
