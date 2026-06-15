import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AutocompleteQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  sessionToken!: string;
}

export class PlaceDetailsQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  placeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  sessionToken!: string;
}

/** Reverse geocode: prefer `lat`/`lng`; `latitude`/`longitude` accepted for compatibility. */
export class ReverseGeocodeQueryDto {
  @ValidateIf((dto: ReverseGeocodeQueryDto) => dto.latitude == null)
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ValidateIf((dto: ReverseGeocodeQueryDto) => dto.longitude == null)
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ValidateIf((dto: ReverseGeocodeQueryDto) => dto.lat == null)
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ValidateIf((dto: ReverseGeocodeQueryDto) => dto.lng == null)
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
