import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AxiosError, type AxiosResponse } from 'axios';
import { SteamProfileError, SteamProfileService } from './steam-profile.service';
import type { SteamApiClient } from './steam-api.client';
import type { PrismaService } from '../../prisma.service';

jest.mock('../../prisma.service', () => ({ PrismaService: jest.fn() }));

const steamId = '76561198000000000';
const DAY = 24 * 60 * 60 * 1000;

const summaries = (player: Record<string, unknown> = {}) => ({
  response: {
    players: [
      {
        steamid: steamId,
        personaname: 'Jugador',
        avatarmedium: 'https://avatars/nuevo.jpg',
        communityvisibilitystate: 3,
        ...player,
      },
    ],
  },
});

const library = () => ({
  response: {
    game_count: 3,
    games: [
      { appid: 10, name: 'A', playtime_forever: 600, img_icon_url: '' },
      { appid: 20, name: 'B', playtime_forever: 5, img_icon_url: '' },
      { appid: 30, name: 'C', playtime_forever: 300, img_icon_url: '' },
    ],
  },
});

const storedRow = (ageMs: number, overrides: Record<string, unknown> = {}) => ({
  steamId,
  personaName: 'Guardado',
  avatarUrl: 'https://avatars/viejo.jpg',
  games: [{ appid: 99, playtime_forever: 1000 }],
  lastFetchedAt: new Date(Date.now() - ageMs),
  ...overrides,
});

const axiosError = (status?: number) =>
  new AxiosError(
    'fail',
    status ? 'ERR_BAD_RESPONSE' : 'ECONNRESET',
    undefined,
    undefined,
    status ? ({ status } as AxiosResponse) : undefined,
  );

function setup(ttlDays?: string) {
  const prisma = {
    steamProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
  };
  const api = {
    getPlayerSummaries: jest.fn().mockResolvedValue(summaries()),
    getOwnedGames: jest.fn().mockResolvedValue(library()),
  };
  const config = { get: jest.fn().mockReturnValue(ttlDays) };
  const service = new SteamProfileService(
    prisma as unknown as PrismaService,
    api as unknown as SteamApiClient,
    config as unknown as ConfigService,
  );

  return { prisma, api, config, service };
}

describe('SteamProfileService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cache miss', () => {
    it('fetches from Steam, saves the whole library and returns the profile', async () => {
      const { service, api, prisma } = setup();

      const profile = await service.getProfile(steamId);

      expect(api.getPlayerSummaries).toHaveBeenCalledWith([steamId]);
      expect(api.getOwnedGames).toHaveBeenCalledWith(steamId);

      // Se guarda la biblioteca completa (sin filtrar por minutos jugados).
      const games = [
        { appid: 10, playtime_forever: 600 },
        { appid: 20, playtime_forever: 5 },
        { appid: 30, playtime_forever: 300 },
      ];
      expect(profile).toEqual({
        steamId,
        name: 'Jugador',
        avatarUrl: 'https://avatars/nuevo.jpg',
        games,
      });
      expect(prisma.steamProfile.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.steamProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { steamId },
          create: expect.objectContaining({
            steamId,
            personaName: 'Jugador',
            avatarUrl: 'https://avatars/nuevo.jpg',
            games,
            lastFetchedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('stores a missing avatar as null', async () => {
      const { service, api } = setup();
      api.getPlayerSummaries.mockResolvedValue(summaries({ avatarmedium: '' }));

      await expect(service.getProfile(steamId)).resolves.toMatchObject({
        avatarUrl: null,
      });
    });

    it('still returns the profile when saving to the cache fails', async () => {
      const { service, prisma } = setup();
      prisma.steamProfile.upsert.mockRejectedValue(new Error('db down'));

      await expect(service.getProfile(steamId)).resolves.toMatchObject({
        name: 'Jugador',
      });
    });
  });

  describe('cache hit', () => {
    it('returns a fresh cached profile without calling Steam', async () => {
      const { service, api, prisma } = setup();
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(1 * DAY));

      await expect(service.getProfile(steamId)).resolves.toEqual({
        steamId,
        name: 'Guardado',
        avatarUrl: 'https://avatars/viejo.jpg',
        games: [{ appid: 99, playtime_forever: 1000 }],
      });
      expect(api.getPlayerSummaries).not.toHaveBeenCalled();
      expect(api.getOwnedGames).not.toHaveBeenCalled();
      expect(prisma.steamProfile.upsert).not.toHaveBeenCalled();
    });

    it('refreshes an expired profile and overwrites it', async () => {
      const { service, api, prisma } = setup();
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(8 * DAY));

      await expect(service.getProfile(steamId)).resolves.toMatchObject({
        name: 'Jugador',
      });
      expect(api.getOwnedGames).toHaveBeenCalledTimes(1);
      expect(prisma.steamProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            personaName: 'Jugador',
            lastFetchedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('treats a stored library with an unexpected shape as a cache miss', async () => {
      const { service, api, prisma } = setup();
      prisma.steamProfile.findUnique.mockResolvedValue(
        storedRow(1 * DAY, { games: { not: 'an array' } }),
      );

      await expect(service.getProfile(steamId)).resolves.toMatchObject({
        name: 'Jugador',
      });
      expect(api.getOwnedGames).toHaveBeenCalledTimes(1);
    });
  });

  describe('time to live', () => {
    it('defaults to 7 days', () => {
      expect(setup().service.cacheTtlMs).toBe(7 * DAY);
    });

    it('is configurable with STEAM_PROFILE_CACHE_TTL_DAYS', async () => {
      const { service, config, api, prisma } = setup('30');
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(10 * DAY));

      await service.getProfile(steamId);

      expect(config.get).toHaveBeenCalledWith('STEAM_PROFILE_CACHE_TTL_DAYS');
      expect(service.cacheTtlMs).toBe(30 * DAY);
      expect(api.getPlayerSummaries).not.toHaveBeenCalled();
    });

    it('a shorter configured TTL expires profiles that the default would keep', async () => {
      const { service, api, prisma } = setup('1');
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(2 * DAY));

      await service.getProfile(steamId);

      expect(api.getPlayerSummaries).toHaveBeenCalledTimes(1);
    });

    it.each(['abc', '0', '-3', ''])(
      'falls back to 7 days when the configured value is %p',
      (value) => {
        expect(setup(value).service.cacheTtlMs).toBe(7 * DAY);
      },
    );
  });

  describe('Steam failures', () => {
    it.each([
      ['a network error', undefined],
      ['a 5xx response', 503],
      ['rate limiting (429)', 429],
    ])('uses the expired profile on %s', async (_label, status) => {
      const { service, api, prisma } = setup();
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(30 * DAY));
      api.getPlayerSummaries.mockRejectedValue(axiosError(status));

      await expect(service.getProfile(steamId)).resolves.toMatchObject({
        name: 'Guardado',
        games: [{ appid: 99, playtime_forever: 1000 }],
      });
      expect(prisma.steamProfile.upsert).not.toHaveBeenCalled();
    });

    it('does not hide a non-transient Steam error behind the expired profile', async () => {
      const { service, api, prisma } = setup();
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(30 * DAY));
      api.getPlayerSummaries.mockRejectedValue(axiosError(403));

      await expect(service.getProfile(steamId)).rejects.toThrow('fail');
    });

    it('propagates the error when there is no cached profile to fall back to', async () => {
      const { service, api } = setup();
      api.getPlayerSummaries.mockRejectedValue(axiosError(503));

      await expect(service.getProfile(steamId)).rejects.toThrow('fail');
    });

    it('also falls back to the expired profile on a transient error reading the library', async () => {
      const { service, api, prisma } = setup();
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(30 * DAY));
      api.getOwnedGames.mockRejectedValue(axiosError(500));

      await expect(service.getProfile(steamId)).resolves.toMatchObject({
        name: 'Guardado',
      });
    });
  });

  describe('unusable profiles are never cached', () => {
    it('rejects a SteamID that does not exist', async () => {
      const { service, api, prisma } = setup();
      api.getPlayerSummaries.mockResolvedValue({ response: { players: [] } });

      await expect(service.getProfile(steamId)).rejects.toThrow(
        SteamProfileError,
      );
      expect(api.getOwnedGames).not.toHaveBeenCalled();
      expect(prisma.steamProfile.upsert).not.toHaveBeenCalled();
    });

    it('rejects a private profile, exposing what is known about it', async () => {
      const { service, api, prisma } = setup();
      api.getPlayerSummaries.mockResolvedValue(
        summaries({ communityvisibilitystate: 1 }),
      );

      await expect(service.getProfile(steamId)).rejects.toMatchObject({
        message: expect.stringContaining('privado'),
        details: {
          isPrivate: true,
          name: 'Jugador',
          avatarUrl: 'https://avatars/nuevo.jpg',
        },
      });
      expect(api.getOwnedGames).not.toHaveBeenCalled();
      expect(prisma.steamProfile.upsert).not.toHaveBeenCalled();
    });

    it('does not serve an expired profile whose owner has gone private', async () => {
      const { service, api, prisma } = setup();
      prisma.steamProfile.findUnique.mockResolvedValue(storedRow(30 * DAY));
      api.getPlayerSummaries.mockResolvedValue(
        summaries({ communityvisibilitystate: 1 }),
      );

      await expect(service.getProfile(steamId)).rejects.toThrow(
        SteamProfileError,
      );
    });

    it('rejects a public profile whose library is not accessible', async () => {
      const { service, api, prisma } = setup();
      api.getOwnedGames.mockResolvedValue({ response: {} });

      await expect(service.getProfile(steamId)).rejects.toMatchObject({
        message: expect.stringContaining(steamId),
        details: { name: 'Jugador' },
      });
      expect(prisma.steamProfile.upsert).not.toHaveBeenCalled();
    });

    it('caches a public empty library', async () => {
      const { service, api, prisma } = setup();
      api.getOwnedGames.mockResolvedValue({ response: { game_count: 0 } });

      await expect(service.getProfile(steamId)).resolves.toMatchObject({
        games: [],
      });
      expect(prisma.steamProfile.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
