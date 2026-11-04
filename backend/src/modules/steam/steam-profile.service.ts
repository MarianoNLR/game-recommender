import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma.service';
import { SteamApiClient } from './steam-api.client';
import { extractLibraryGames } from './steam-library.util';
import { DEFAULT_PROFILE_CACHE_TTL_DAYS } from './steam.constants';
import type { OwnedGame, SteamProfileData } from './steam.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * El perfil no se puede usar (no existe, es privado o la biblioteca no es
 * accesible). Nunca se cachea. `details` trae lo que se llegó a conocer del
 * perfil, para mostrarlo en la validación.
 */
export class SteamProfileError extends BadRequestException {
  constructor(
    message: string,
    readonly details: {
      isPrivate?: boolean;
      name?: string;
      avatarUrl?: string | null;
    } = {},
  ) {
    super(message);
  }
}

/**
 * Perfiles de Steam (nombre, avatar y biblioteca) cacheados en la base para no
 * consultar la API de Steam cada vez que el mismo usuario aparece en un grupo.
 * No son usuarios de la página: es solo una caché con vencimiento.
 */
@Injectable()
export class SteamProfileService {
  private readonly logger = new Logger(SteamProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly steamApiClient: SteamApiClient,
    private readonly configService: ConfigService,
  ) {}

  /** Vigencia de la caché en ms (STEAM_PROFILE_CACHE_TTL_DAYS, por defecto 7 días). */
  get cacheTtlMs(): number {
    const days = Number(
      this.configService.get<string>('STEAM_PROFILE_CACHE_TTL_DAYS'),
    );

    return (
      (Number.isFinite(days) && days > 0 ? days : DEFAULT_PROFILE_CACHE_TTL_DAYS) *
      DAY_MS
    );
  }

  /**
   * Devuelve el perfil desde la caché si está vigente; si no, lo consulta a
   * Steam y lo guarda. Si Steam falla de forma transitoria (red, 429 o 5xx) y
   * hay un perfil vencido, usa el vencido. Los perfiles privados o inaccesibles
   * lanzan SteamProfileError y no se guardan.
   */
  async getProfile(steamId: string): Promise<SteamProfileData> {
    const row = await this.prisma.steamProfile.findUnique({
      where: { steamId },
    });
    const games = row ? this.parseGames(row.games) : null;
    const cached: SteamProfileData | null =
      row && games
        ? {
            steamId,
            name: row.personaName,
            avatarUrl: row.avatarUrl,
            games,
          }
        : null;

    if (row && cached && this.isFresh(row.lastFetchedAt)) {
      return cached;
    }

    try {
      return await this.refresh(steamId);
    } catch (error) {
      if (cached && this.isTransientError(error)) {
        this.logger.warn(
          `Steam no respondió para ${steamId}; se usa el perfil cacheado vencido.`,
        );
        return cached;
      }

      throw error;
    }
  }

  private async refresh(steamId: string): Promise<SteamProfileData> {
    const summaries = await this.steamApiClient.getPlayerSummaries([steamId]);
    const [player] = summaries.response.players;

    if (!player) {
      throw new SteamProfileError(`SteamID ${steamId} no encontrado`);
    }

    const name = player.personaname;
    const avatarUrl = player.avatarmedium || null;

    if (player.communityvisibilitystate !== 3) {
      throw new SteamProfileError(
        `El perfil del SteamID ${steamId} es privado. Configuralo como público en Steam.`,
        { isPrivate: true, name, avatarUrl },
      );
    }

    let games: OwnedGame[];
    try {
      const library = await this.steamApiClient.getOwnedGames(steamId);
      games = extractLibraryGames(library, steamId).map((game) => ({
        appid: game.appid,
        playtime_forever: game.playtime_forever ?? 0,
      }));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new SteamProfileError(error.message, { name, avatarUrl });
      }

      throw error;
    }

    await this.save(steamId, name, avatarUrl, games);

    return { steamId, name, avatarUrl, games };
  }

  // Guardar es una optimización: si falla, el request igual se resuelve.
  private async save(
    steamId: string,
    name: string,
    avatarUrl: string | null,
    games: OwnedGame[],
  ): Promise<void> {
    const data = {
      personaName: name,
      avatarUrl,
      games: games as unknown as Prisma.InputJsonValue,
      lastFetchedAt: new Date(),
    };

    try {
      await this.prisma.steamProfile.upsert({
        where: { steamId },
        create: { steamId, ...data },
        update: data,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo guardar el perfil de ${steamId} en la caché`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private isFresh(lastFetchedAt: Date): boolean {
    return Date.now() - lastFetchedAt.getTime() < this.cacheTtlMs;
  }

  // Red caída (sin respuesta), rate limit o error del servidor de Steam.
  private isTransientError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    const status = error.response?.status;

    return status === undefined || status === 429 || status >= 500;
  }

  // Si el JSON guardado no tiene la forma esperada, se trata como caché vacía.
  private parseGames(value: unknown): OwnedGame[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const games: OwnedGame[] = [];

    for (const item of value as Array<Record<string, unknown> | null>) {
      if (
        typeof item?.appid !== 'number' ||
        typeof item?.playtime_forever !== 'number'
      ) {
        return null;
      }

      games.push({ appid: item.appid, playtime_forever: item.playtime_forever });
    }

    return games;
  }
}
