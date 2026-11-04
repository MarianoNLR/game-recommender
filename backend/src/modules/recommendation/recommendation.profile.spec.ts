import { RecommendationService } from './recommendation.service';
import type { SteamProfileService } from '../steam/steam-profile.service';
import type { GroupsService } from '../groups/groups.service';
import type { GameService } from '../game/game.service';

jest.mock('../groups/groups.service', () => ({ GroupsService: jest.fn() }));
jest.mock('../game/game.service', () => ({ GameService: jest.fn() }));
jest.mock('../../prisma.service', () => ({ PrismaService: jest.fn() }));

const library = (games: [appid: number, minutes: number][]) =>
  games.map(([appid, playtime_forever]) => ({ appid, playtime_forever }));

// Juegos que existen en la base, con sus tags.
const catalog: Record<number, { name: string; imageUrl: string | null; tags: string[] }> = {
  100: { name: 'Shooter RPG', imageUrl: 'https://img/100.jpg', tags: ['Action', 'RPG', 'Multiplayer'] },
  200: { name: 'Indie Game', imageUrl: null, tags: ['Indie'] },
  300: { name: 'Muy poco jugado', imageUrl: null, tags: ['Action'] },
  500: { name: 'Solo modos', imageUrl: null, tags: ['Multiplayer', 'Co-op'] },
};

const members = [
  {
    steamId: '1',
    name: 'Ana',
    games: library([
      [100, 1000],
      [200, 500],
      [300, 200], // menos de 300 min: no cuenta
      [400, 800], // no está en la base: no cuenta
      [500, 600], // solo tags de modo de juego: no cuenta
    ]),
  },
  { steamId: '2', name: 'Bruno', games: library([[100, 300]]) },
];

function setup() {
  const steamProfiles = {
    getProfile: jest.fn(async (steamId: string) => {
      const member = members.find((item) => item.steamId === steamId)!;
      return {
        steamId,
        name: member.name,
        avatarUrl: `${member.name}.png`,
        games: member.games,
      };
    }),
  };
  const groups = {
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      name: 'Viernes',
      budget: null,
      accessCode: 'code',
      expiresAt: new Date('2099-01-01'),
      memberSteamIds: members.map(({ steamId }) => steamId),
    }),
  };
  const gameService = {
    findTagsByAppIds: jest.fn(async (appIds: number[]) =>
      appIds
        .filter((appId) => catalog[appId])
        .map((appId) => ({
          steamAppId: appId,
          name: catalog[appId].name,
          imageUrl: catalog[appId].imageUrl,
          tags: catalog[appId].tags.map((name, index) => ({
            weight: 100 - index,
            tag: { name, steamTagId: index + 1 },
          })),
        })),
    ),
  };

  const service = new RecommendationService(
    steamProfiles as unknown as SteamProfileService,
    groups as unknown as GroupsService,
    gameService as unknown as GameService,
  );

  return { service };
}

describe('group profile summary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists only the games that counted for each member, heaviest first', async () => {
    const { service } = setup();

    const { members: summary } = await service.getGroupProfileSummary('code');
    const ana = summary.find(({ steamId }) => steamId === '1')!;

    expect(ana.countedGames.map(({ appId }) => appId)).toEqual([100, 200]);
    expect(ana.countedGames[0]).toMatchObject({
      appId: 100,
      name: 'Shooter RPG',
      imageUrl: 'https://img/100.jpg',
      // Los tags de modo de juego (Multiplayer) no cuentan para el perfil.
      tags: ['Action', 'RPG'],
    });
    expect(ana.countedGames[0].share).toBeCloseTo(1000 / 1500);
    expect(ana.countedGames[1].share).toBeCloseTo(500 / 1500);
  });

  it('shares add up to 1 and are 1 for a single counted game', async () => {
    const { service } = setup();

    const { members: summary } = await service.getGroupProfileSummary('code');

    for (const member of summary) {
      const total = member.countedGames.reduce((sum, game) => sum + game.share, 0);
      expect(total).toBeCloseTo(1);
    }
    expect(summary.find(({ steamId }) => steamId === '2')!.countedGames).toHaveLength(1);
  });

  it('breaks each top group tag down by member and game', async () => {
    const { service } = setup();

    const { topGroupTags, groupTagBreakdown } =
      await service.getGroupProfileSummary('code');

    expect(topGroupTags).toEqual(expect.arrayContaining(['Action', 'RPG', 'Indie']));
    // Indie lo tiene un solo miembro, así que va último.
    expect(topGroupTags[topGroupTags.length - 1]).toBe('Indie');

    const action = groupTagBreakdown.find(({ tag }) => tag === 'Action')!;
    expect(action.members.map(({ steamId }) => steamId).sort()).toEqual(['1', '2']);
    expect(action.members.flatMap(({ games }) => games.map(({ appId }) => appId))).toEqual([100, 100]);

    const indie = groupTagBreakdown.find(({ tag }) => tag === 'Indie')!;
    expect(indie.members).toEqual([
      { steamId: '1', games: [expect.objectContaining({ appId: 200 })] },
    ]);
  });

  it('does not expose minutes played or the full library', async () => {
    const { service } = setup();

    const summary = await service.getGroupProfileSummary('code');

    expect(JSON.stringify(summary)).not.toContain('playtime');
    expect(Object.keys(summary.members[0]).sort()).toEqual([
      'avatarUrl',
      'countedGames',
      'name',
      'steamId',
      'topTags',
    ]);
    expect(summary.group).toEqual({ name: 'Viernes', accessCode: 'code', budget: null });
  });
});
