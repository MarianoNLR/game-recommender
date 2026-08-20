/* eslint-disable @typescript-eslint/no-unused-vars */
import SteamUser from 'steam-user';

export class SteamUserClient {
  private readonly client: SteamUser;

  constructor() {
    this.client = new SteamUser();
  }

  async login(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('loggedOn', () => {
        console.log('Steam User conectado');
        resolve();
      });

      this.client.once('error', (error) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      });

      this.client.logOn({
        anonymous: true,
      });
    });
  }

  async getProductInfo(appIds: number[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.getProductInfo(appIds, [], (apps, packages) => {
        resolve({ apps, packages });
      });
    });
  }

  logOff(): void {
    this.client.logOff();
  }
}
