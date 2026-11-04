import { BadRequestException } from '@nestjs/common';
import { SteamService } from './steam.service';
import { SteamProfileService } from './steam-profile.service';
import type { ConfigService } from '@nestjs/config';
import { SteamApiClient } from './steam-api.client';
import { SteamStoreClient } from './steam-store.client';
import { GameService } from '../game/game.service';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../../prisma.service';
import type { SteamGame } from './steam.types';

jest.mock('../game/game.service', () => ({ GameService: jest.fn() }));
jest.mock('./steam-store.client', () => ({ SteamStoreClient: jest.fn() }));
jest.mock('../../prisma.service', () => ({ PrismaService: jest.fn() }));

describe('Steam library access and group creation', () => {
  const steamId = '76561198000000000';
  let api: {
    getOwnedGames: jest.Mock;
    getPlayerSummaries: jest.Mock;
  };
  let steam: SteamService;
  let profileRow: jest.Mock;
  let create: jest.Mock;
  let groups: GroupsService;

  beforeEach(() => {
    api = {
      getOwnedGames: jest.fn(),
      getPlayerSummaries: jest.fn().mockResolvedValue({
        response: {
          players: [{ steamid: steamId, communityvisibilitystate: 3, personaname: 'Jugador', avatarmedium: 'avatar' }],
        },
      }),
    };
    profileRow = jest.fn().mockResolvedValue(null);
    const profiles = new SteamProfileService(
      {
        steamProfile: {
          findUnique: profileRow,
          upsert: jest.fn().mockResolvedValue(undefined),
        },
      } as unknown as PrismaService,
      api as unknown as SteamApiClient,
      { get: jest.fn() } as unknown as ConfigService,
    );
    steam = new SteamService(
      api as unknown as SteamApiClient,
      {} as SteamStoreClient,
      {} as GameService,
      profiles,
    );
    create = jest.fn().mockResolvedValue({ accessCode: 'group-code' });
    groups = new GroupsService({ group: { create } } as unknown as PrismaService, steam);
  });

  it('rejects a public profile with an inaccessible library before saving a group', async () => {
    api.getOwnedGames.mockResolvedValue({ response: {} });
    await expect(steam.validateMember(steamId)).resolves.toMatchObject({
      isValid: false,
      reason: expect.stringContaining(steamId),
    });
    await expect(groups.create({ name: 'Grupo', memberSteamIds: [steamId] }, '127.0.0.1'))
      .rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns an actionable error when an existing group loses library access', async () => {
    api.getOwnedGames.mockResolvedValue({ response: {} });
    await expect(steam.getOwnedGames(steamId)).rejects.toThrow('detalles de juegos');
  });

  it('accepts a public empty library without classifying it as private', async () => {
    api.getOwnedGames.mockResolvedValue({ response: { game_count: 0 } });
    await expect(steam.getOwnedGames(steamId)).resolves.toEqual([]);
    await expect(steam.validateMember(steamId)).resolves.toMatchObject({ isValid: true });
    await groups.create({ name: 'Grupo', memberSteamIds: [steamId] }, '127.0.0.1');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('keeps the playtime filter for readable libraries', async () => {
    const game: SteamGame = { appid: 10, name: 'Juego', playtime_forever: 300, img_icon_url: '', content_descriptorids: [] };
    api.getOwnedGames.mockResolvedValue({ response: { game_count: 2, games: [game, { ...game, appid: 20, playtime_forever: 299 }] } });
    await expect(steam.getOwnedGames(steamId)).resolves.toEqual([game]);
  });

  it('does not confuse a Steam outage with private games or save a group', async () => {
    api.getOwnedGames.mockRejectedValue(new Error('Steam unavailable'));
    await expect(groups.create({ name: 'Grupo', memberSteamIds: [steamId] }, '127.0.0.1'))
      .rejects.toThrow('Steam unavailable');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects missing and private profiles without querying their libraries', async () => {
    api.getPlayerSummaries.mockResolvedValueOnce({ response: { players: [] } });
    await expect(steam.validateMember(steamId)).resolves.toMatchObject({ isValid: false });
    api.getPlayerSummaries.mockResolvedValueOnce({ response: { players: [{ communityvisibilitystate: 1 }] } });
    await expect(steam.validateMember(steamId)).resolves.toMatchObject({ isValid: false, isPrivate: true });
    expect(api.getOwnedGames).not.toHaveBeenCalled();
  });

  it('validates a member from the cached profile without calling Steam', async () => {
    profileRow.mockResolvedValue({
      steamId,
      personaName: 'Cacheado',
      avatarUrl: null,
      games: [],
      lastFetchedAt: new Date(),
    });

    await expect(steam.validateMember(steamId)).resolves.toMatchObject({
      isValid: true,
      name: 'Cacheado',
      avatarUrl: null,
    });
    expect(api.getPlayerSummaries).not.toHaveBeenCalled();
    expect(api.getOwnedGames).not.toHaveBeenCalled();
  });
});
