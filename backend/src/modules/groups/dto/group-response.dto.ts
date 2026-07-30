import { Expose, Type } from 'class-transformer';

// export class MemberResponseDto {
//   @Expose()
//   id: number;

//   @Expose()
//   steamId: string;
// }

export class GroupResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  budget: number | null;

  @Expose()
  accessCode: string;

  @Expose()
  expiresAt: Date;

  @Expose()
  // @Type(() => MemberResponseDto)
  memberSteamIds: string[];
}
