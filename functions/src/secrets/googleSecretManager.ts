import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import type { SecretStore } from './secretStore';

/**
 * Google Secret Manager store. The Cloud Functions service account needs
 * roles/secretmanager.admin on the project (or a scoped custom role) — see
 * docs/SETUP.md. Secret ids are `forma-ai-<providerId>`.
 */
export class GoogleSecretManagerStore implements SecretStore {
  private client = new SecretManagerServiceClient();
  constructor(private projectId: string) {}

  private name(id: string) {
    return `projects/${this.projectId}/secrets/forma-ai-${id}`;
  }

  async put(id: string, value: string) {
    const name = this.name(id);
    try {
      await this.client.getSecret({ name });
    } catch (err) {
      if ((err as { code?: number }).code !== 5) throw err; // 5 = NOT_FOUND
      await this.client.createSecret({
        parent: `projects/${this.projectId}`,
        secretId: `forma-ai-${id}`,
        secret: { replication: { automatic: {} }, labels: { app: 'forma', kind: 'ai-provider' } },
      });
    }
    const [version] = await this.client.addSecretVersion({ parent: name, payload: { data: Buffer.from(value, 'utf8') } });
    // Disable older versions so a rotated key stops working everywhere.
    const [versions] = await this.client.listSecretVersions({ parent: name });
    await Promise.all(
      versions
        .filter((v) => v.name !== version.name && v.state === 'ENABLED')
        .map((v) => this.client.disableSecretVersion({ name: v.name! })),
    );
    return { ref: version.name ?? name };
  }

  async get(id: string) {
    try {
      const [res] = await this.client.accessSecretVersion({ name: `${this.name(id)}/versions/latest` });
      const data = res.payload?.data;
      return data ? Buffer.from(data as Uint8Array).toString('utf8') : undefined;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 5 || code === 9) return undefined; // NOT_FOUND / FAILED_PRECONDITION (disabled)
      throw err;
    }
  }

  async disable(id: string) {
    const [versions] = await this.client.listSecretVersions({ parent: this.name(id) });
    await Promise.all(versions.filter((v) => v.state === 'ENABLED').map((v) => this.client.disableSecretVersion({ name: v.name! })));
  }

  async remove(id: string) {
    try {
      await this.client.deleteSecret({ name: this.name(id) });
    } catch (err) {
      if ((err as { code?: number }).code !== 5) throw err;
    }
  }
}
