import {
  type DismissalInput,
  DeliveryType,
  DismissalType,
  type EditDeliveryRequest,
  type RecordDeliveryRequest,
} from '@acc/types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const DELIVERY_TYPES = Object.values(DeliveryType);
const DISMISSAL_TYPES = Object.values(DismissalType);

class DismissalInputDto implements DismissalInput {
  @IsIn(DISMISSAL_TYPES)
  type!: DismissalType;

  @IsOptional()
  @IsString()
  dismissedId?: string | null;

  @IsOptional()
  @IsString()
  fielderId?: string | null;

  @IsOptional()
  @IsString()
  fielder2Id?: string | null;
}

export class RecordDeliveryDto implements RecordDeliveryRequest {
  @IsIn(DELIVERY_TYPES)
  type!: DeliveryType;

  @IsOptional()
  @IsString()
  strikerId?: string | null;

  @IsOptional()
  @IsString()
  nonStrikerId?: string | null;

  @IsOptional()
  @IsString()
  bowlerId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  runsBat?: number;

  @IsOptional()
  @IsInt()
  extraRuns?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  noBallByeRuns?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  noBallLegByeRuns?: number;

  @IsOptional()
  @IsString()
  penaltyBeneficiaryTeamId?: string | null;

  @IsOptional()
  @IsBoolean()
  isBoundary?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DismissalInputDto)
  dismissal?: DismissalInputDto | null;

  @IsOptional()
  @IsString()
  fielderId?: string | null;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class EditDeliveryDto extends RecordDeliveryDto implements EditDeliveryRequest {
  @IsString()
  deliveryId!: string;
}
