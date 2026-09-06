import { Length } from 'class-validator';

export class SetCountryDto {
  @Length(2, 2)
  country: string;
}
