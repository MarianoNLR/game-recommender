import 'dotenv/config';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../../prisma.service';
import type { SteamGame } from '../steam/steam.types';
import type { SteamProfileService } from '../steam/steam-profile.service';
import type { GroupsService } from '../groups/groups.service';
import { GameService } from '../game/game.service';

jest.mock('../groups/groups.service', () => ({ GroupsService: jest.fn() }));

type TestMember = {
  steamId: string;
  name: string;
  games: SteamGame[];
};

const game = (appid: number, name: string, playtime: number): SteamGame => ({
  appid,
  name,
  playtime_forever: playtime,
  img_icon_url: '',
  content_descriptorids: [],
});

const taggedGame = (steamAppId: number, tags: string[]) => ({
  steamAppId,
  name: `Game ${steamAppId}`,
  imageUrl: null,
  tags: tags.map((name, index) => ({
    weight: 100 - index,
    tag: { name, steamTagId: index + 1 },
  })),
});

describe('RecommendationService group recommendation flow', () => {
  const accessCode = 'test-party-5';
  const members: TestMember[] = [
    {
      steamId: '76561198000000001',
      name: 'Ana',
      games: [game(1001, 'Hades-like', 600), game(1101, 'Action game', 300)],
    },
    {
      steamId: '76561198000000002',
      name: 'Bruno',
      games: [
        game(1002, 'Fantasy quest', 500),
        game(1102, 'Adventure game', 250),
      ],
    },
    {
      steamId: '76561198000000003',
      name: 'Carla',
      games: [game(1003, 'Action RPG', 700), game(1103, 'RPG game', 200)],
    },
    {
      steamId: '76561198000000004',
      name: 'Diego',
      games: [
        game(1004, 'Roguelike adventure', 650),
        game(1104, 'Fantasy game', 350),
      ],
    },
    {
      steamId: '76561198000000005',
      name: 'Elena',
      games: [
        game(1005, 'Indie adventure', 550),
        game(1105, 'Action indie', 300),
      ],
    },
  ];

  it('builds a tag profile for five stored members and returns only unowned multiplayer recommendations', async () => {
    const groups = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Viernes cooperativo',
        // Group.budget is persisted in cents by GroupsService.create().
        budget: 2999,
        accessCode,
        expiresAt: new Date('2099-01-01'),
        memberSteamIds: members.map(({ steamId }) => steamId),
      }),
    };

    const steamProfiles = {
      getProfile: jest.fn((steamId: string) => {
        const member = members.find((item) => item.steamId === steamId)!;
        return {
          steamId,
          name: member.name,
          avatarUrl: `${member.name}.png`,
          games: member.games,
        };
      }),
    };

    const tagsByOwnedAppId = new Map<number, string[]>([
      [1001, ['Action', 'RPG', 'Roguelike']],
      [1101, ['Action', 'Indie']],
      [1002, ['Adventure', 'Fantasy', 'RPG']],
      [1102, ['Adventure', 'Indie']],
      [1003, ['Action', 'RPG', 'Fantasy']],
      [1103, ['RPG', 'Roguelike']],
      [1004, ['Adventure', 'Roguelike', 'Fantasy']],
      [1104, ['RPG', 'Fantasy']],
      [1005, ['Action', 'Adventure', 'Indie']],
      [1105, ['Action', 'Indie']],
    ]);

    const prisma = new PrismaService();
    const gameService = new GameService(prisma);
    jest
      .spyOn(gameService, 'findTagsByAppIds')
      // eslint-disable-next-line @typescript-eslint/require-await
      .mockImplementation(async (appIds) =>
        appIds.map((appId) => taggedGame(appId, tagsByOwnedAppId.get(appId)!)),
      );

    const service = new RecommendationService(
      steamProfiles as unknown as SteamProfileService,
      groups as unknown as GroupsService,
      gameService,
    );

    const result = await service.getGroupRecommendations(accessCode);

    expect(groups.findOne).toHaveBeenCalledWith(accessCode);
    expect(steamProfiles.getProfile).toHaveBeenCalledTimes(5);
    expect(result.topGroupTags.slice(0, 3)).toEqual([
      'RPG',
      'Action',
      'Fantasy',
    ]);
    expect(result.groupTagScores.Action.memberCount).toBe(3);
    expect(result.groupTagScores.RPG.memberCount).toBe(4);
    const recommendations = [
      ...result.groupRecommendations.paidRecommendations,
      ...result.groupRecommendations.freeRecommendations,
    ];
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ steamAppId: 1001 })]),
    );
    expect(
      recommendations.every(({ matchedTagCount }) => matchedTagCount >= 3),
    ).toBe(true);
    await prisma.$disconnect();
  });
});
