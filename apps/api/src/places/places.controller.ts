import type {
  PlaceDetails,
  PlaceSuggestion,
  ResolvedLocationResult,
  ReverseGeocodeResult,
} from '@acc/types';
import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AutocompleteQueryDto,
  PlaceDetailsQueryDto,
  ReverseGeocodeQueryDto,
} from './dto/places-query.dto';
import { ResolveMapsLinkQueryDto } from './dto/resolve-maps-link-query.dto';
import { PlacesService } from './places.service';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get('autocomplete')
  autocomplete(
    @CurrentUser() user: { id: string },
    @Query() query: AutocompleteQueryDto,
  ): Promise<PlaceSuggestion[]> {
    return this.places.autocomplete(user.id, query.q, query.sessionToken);
  }

  @Get('details')
  details(
    @CurrentUser() user: { id: string },
    @Query() query: PlaceDetailsQueryDto,
  ): Promise<PlaceDetails> {
    return this.places.details(user.id, query.placeId, query.sessionToken);
  }

  @Get('reverse')
  reverse(
    @CurrentUser() user: { id: string },
    @Query() query: ReverseGeocodeQueryDto,
  ): Promise<ReverseGeocodeResult> {
    const latitude = query.lat ?? query.latitude;
    const longitude = query.lng ?? query.longitude;
    if (latitude == null || longitude == null) {
      throw new BadRequestException({
        message: 'lat and lng query parameters are required',
        error: 'INVALID_COORDINATES',
      });
    }
    return this.places.reverse(user.id, latitude, longitude);
  }

  @Get('resolve-maps-link')
  resolveMapsLink(
    @CurrentUser() user: { id: string },
    @Query() query: ResolveMapsLinkQueryDto,
  ): Promise<ResolvedLocationResult> {
    return this.places.resolveMapsLink(user.id, query.url);
  }
}
