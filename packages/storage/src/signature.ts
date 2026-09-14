import { createHmac, timingSafeEqual } from 'node:crypto';

export type StorageAction = 'put' | 'get';

const buildPayload = (action: StorageAction, key: string, expires: number): string =>
  `${action}:${key}:${expires}`;

export const createStorageSignature = (
  action: StorageAction,
  key: string,
  expires: number,
  secret: string,
): string => {
  return createHmac('sha256', secret)
    .update(buildPayload(action, key, expires))
    .digest('hex');
};

export const verifyStorageSignature = (
  action: StorageAction,
  key: string,
  expires: number,
  signature: string,
  secret: string,
): boolean => {
  const now = Math.floor(Date.now() / 1000);
  if (expires < now) {
    return false;
  }
  const expected = createStorageSignature(action, key, expires, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
};
