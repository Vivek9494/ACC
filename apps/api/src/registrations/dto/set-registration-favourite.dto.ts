import { IsBoolean } from 'class-validator';

/** Body for favouriting / unfavouriting a verified registrant. */
export class SetRegistrationFavouriteDto {
  @IsBoolean()
  favourited!: boolean;
}
