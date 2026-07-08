import {
  type AuthUser,
  type AvailabilitySummary,
  type CustomFormRequestSummary,
  Permission,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  type RegistrationSummary,
  type RegistrationVerificationQueue,
  type VerifiedRegisteredPlayersView,
  type LeatherRegisteredPlayersView,
} from '@acc/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { BuildCustomFormDto, CreateCustomFormRequestDto } from './dto/custom-form.dto';
import { ListLeatherRegisteredPlayersDto } from './dto/list-leather-registrations.dto';
import { ListRegistrationsDto } from './dto/list-registrations.dto';
import { LateRegistrationDto, SubmitRegistrationDto } from './dto/submit-registration.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateRatingsDto } from './dto/update-ratings.dto';
import { RegistrationsService } from './registrations.service';

/**
 * Player registration endpoints (spec §7), nested under a tournament. Scope-
 * sensitive routes (approve/decline, ratings, availability) carry a
 * `:registrationId` so the {@link PermissionGuard} can resolve the target
 * Center for OWN_CENTER checks.
 */
@Controller('tournaments/:tournamentId/registrations')
@UseGuards(JwtAuthGuard)
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  /** §7.1/§7.3: a player submits their own registration → In Waitlist. */
  @Post()
  submit(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: SubmitRegistrationDto,
  ): Promise<RegistrationDetail> {
    return this.registrations.submit(user, tournamentId, dto);
  }

  /** §7.4: registration list, Center-scoped by the actor's visibility. */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Query() query: ListRegistrationsDto,
  ): Promise<RegistrationSummary[]> {
    return this.registrations.list(user, tournamentId, query);
  }

  /** Verified registrants (all centers) — Captain / VC / Manager after verification (tennis). */
  @Get('verified')
  @RequirePermission(Permission.VIEW_VERIFIED_REGISTERED_PLAYERS)
  @UseGuards(PermissionGuard)
  listVerified(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Query() query: ListRegistrationsDto,
  ): Promise<VerifiedRegisteredPlayersView> {
    return this.registrations.listVerifiedRegisteredPlayers(user, tournamentId, query);
  }

  /** Leather ACC registrants — Admin / Club Manager squad-building (view-only). */
  @Get('leather')
  @RequirePermission(Permission.VIEW_LEATHER_REGISTERED_PLAYERS)
  @UseGuards(PermissionGuard)
  listLeather(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Query() query: ListLeatherRegisteredPlayersDto,
  ): Promise<LeatherRegisteredPlayersView> {
    return this.registrations.listLeatherRegisteredPlayers(user, tournamentId, query);
  }

  @Get('me')
  mine(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<RegistrationDetail | null> {
    return this.registrations.getMine(user, tournamentId);
  }

  /** §7.3/§7.4: Center Sevak verification queue (tennis only). */
  @Get('verification-queue')
  verificationQueue(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<RegistrationVerificationQueue> {
    return this.registrations.getVerificationQueue(user, tournamentId);
  }

  /** §7.5: availability bar-chart aggregate (APL). */
  @Get('availability')
  @RequirePermission(Permission.VIEW_AVAILABILITY_CHART)
  @UseGuards(PermissionGuard)
  availability(@Param('tournamentId') tournamentId: string): Promise<AvailabilitySummary> {
    return this.registrations.availabilitySummary(tournamentId);
  }

  /** §7.6: late registration of a missed player (Organizer / Center Sevak). */
  @Post('late')
  lateRegister(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: LateRegistrationDto,
  ): Promise<RegistrationDetail> {
    return this.registrations.lateRegister(user, tournamentId, dto);
  }

  // --- Custom forms (§7.2, §21) --------------------------------------------

  @Get('form-fields')
  formFields(
    @Param('tournamentId') tournamentId: string,
  ): Promise<RegistrationFieldDefinition[]> {
    return this.registrations.listFormFields(tournamentId);
  }

  /** Admin builds the tournament's custom form (§7.2). */
  @Put('form-fields')
  @RequirePermission(Permission.BUILD_CUSTOM_FORM)
  @UseGuards(PermissionGuard)
  buildForm(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: BuildCustomFormDto,
  ): Promise<RegistrationFieldDefinition[]> {
    return this.registrations.buildCustomForm(tournamentId, dto);
  }

  /** Organizer requests extra fields from Admin (§7.2). */
  @Post('custom-form-requests')
  @RequirePermission(Permission.REQUEST_CUSTOM_FORM)
  @UseGuards(PermissionGuard)
  requestCustomForm(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateCustomFormRequestDto,
  ): Promise<CustomFormRequestSummary> {
    return this.registrations.requestCustomForm(user, tournamentId, dto);
  }

  @Get('custom-form-requests')
  @RequirePermission(Permission.REQUEST_CUSTOM_FORM)
  @UseGuards(PermissionGuard)
  listCustomFormRequests(
    @Param('tournamentId') tournamentId: string,
  ): Promise<CustomFormRequestSummary[]> {
    return this.registrations.listCustomFormRequests(tournamentId);
  }

  // --- Review & ratings (§7.3, §7.5) ---------------------------------------

  /** §7.3: Center Sevak (own Center) / Admin confirms a registration. */
  @Post(':registrationId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.APPROVE_REGISTRATION)
  @UseGuards(PermissionGuard)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('registrationId') registrationId: string,
  ): Promise<RegistrationDetail> {
    return this.registrations.approve(user, registrationId);
  }

  /** §7.3: decline → "Declined. Contact Center Sevak". */
  @Post(':registrationId/decline')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.APPROVE_REGISTRATION)
  @UseGuards(PermissionGuard)
  decline(
    @CurrentUser() user: AuthUser,
    @Param('registrationId') registrationId: string,
  ): Promise<RegistrationDetail> {
    return this.registrations.decline(user, registrationId);
  }

  /** §7.5: Center Sevak updates adjusted ratings for an own-Center player (APL). */
  @Patch(':registrationId/ratings')
  @RequirePermission(Permission.UPDATE_PLAYER_RATINGS)
  @UseGuards(PermissionGuard)
  updateRatings(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('registrationId') registrationId: string,
    @Body() dto: UpdateRatingsDto,
  ): Promise<RegistrationDetail> {
    return this.registrations.updateRatings(user, tournamentId, registrationId, dto);
  }

  /** §7.5: Center Sevak records availability for an own-Center player (APL). */
  @Patch(':registrationId/availability')
  @RequirePermission(Permission.UPDATE_PLAYER_AVAILABILITY)
  @UseGuards(PermissionGuard)
  updateAvailability(
    @Param('registrationId') registrationId: string,
    @Body() dto: UpdateAvailabilityDto,
  ): Promise<RegistrationDetail> {
    return this.registrations.updateAvailability(registrationId, dto);
  }
}
