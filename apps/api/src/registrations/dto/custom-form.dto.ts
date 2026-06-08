import {
  type BuildCustomFormRequest,
  type CreateCustomFormRequest,
  type RegistrationFieldDefinitionInput,
  RegistrationFieldType,
} from '@acc/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const FIELD_TYPES = Object.values(RegistrationFieldType);

/** One custom field spec (spec §7.2, §21). */
export class RegistrationFieldDto implements RegistrationFieldDefinitionInput {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsIn(FIELD_TYPES)
  fieldType!: RegistrationFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[] | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/** Admin builds/replaces a tournament's custom form (spec §7.2). */
export class BuildCustomFormDto implements BuildCustomFormRequest {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RegistrationFieldDto)
  fields!: RegistrationFieldDto[];
}

/** Organizer requests extra fields from Admin (spec §7.2). */
export class CreateCustomFormRequestDto implements CreateCustomFormRequest {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RegistrationFieldDto)
  requestedFields?: RegistrationFieldDto[] | null;
}
