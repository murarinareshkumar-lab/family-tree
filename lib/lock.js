import { randomUUID } from 'node:crypto';
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export function createLockManager(sheetsClient) {
  return {
    async acquire(lockKey = 'global_member_lock', timeoutMs = 30000) {
      const lockHolder = randomUUID();
      for (let attempt = 1; attempt <= 10; attempt++) {
        const now = Date.now();
        try {
          const current = await sheetsClient.getMeta(lockKey);
          let canAcquire = !current || !current.value;
          if (!canAcquire) {
            try {
              const d = JSON.parse(current.value);
              if (now > (d.expiresAt || 0)) canAcquire = true;
            } catch { canAcquire = true; }
          }
          if (canAcquire) {
            await sheetsClient.setMeta(lockKey, JSON.stringify({ lockHolder, expiresAt: now + timeoutMs }));
            const verify = await sheetsClient.getMeta(lockKey);
            if (verify && verify.value && JSON.parse(verify.value).lockHolder === lockHolder) {
              return {
                acquired: true,
                lockHolder,
                release: async () => this.release(lockKey, lockHolder)
              };
            }
          }
        } catch {}
        await sleep(300 * Math.pow(1.3, attempt) + Math.random() * 200);
      }
      throw new Error(`Failed to acquire lock for key "${lockKey}"`);
    },
    async release(lockKey, lockHolder) {
      try {
        const current = await sheetsClient.getMeta(lockKey);
        if (current && current.value && JSON.parse(current.value).lockHolder === lockHolder) {
          await sheetsClient.setMeta(lockKey, JSON.stringify({ lockHolder: null, expiresAt: 0 }));
        }
      } catch {}
    }
  };
}
