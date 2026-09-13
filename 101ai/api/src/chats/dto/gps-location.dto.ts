import { IsLatitude, IsLongitude } from 'class-validator';

// Shared by CreateChatDto/AddMessageDto — the browser's geolocation result
// for a Steps Planner message (see StepsPlannerService), sent alongside the
// message the same way an attachment or item id already is. Never used by
// any other tool.
export class GpsLocationDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}
