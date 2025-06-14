import { defineStorage } from '@aws-amplify/backend';

export const rawFiles = defineStorage({
  name: 'raw-files',
  isDefault: true,
  access: (allow) => ({
    'private/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete'])
    ],
    'public/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read', 'write', 'delete']) // Development only  
    ],
  }),
});

export const images = defineStorage({
  name: 'images',
  access: (allow) => ({
    'private/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read', 'write']) // Development only
    ],
  }),
});

export const vectorFiles = defineStorage({
  name: 'vector-files',
  versioned: true,
  access: (allow) => ({
    'private/*': [allow.authenticated.to(['read', 'write'])],
  }),
});