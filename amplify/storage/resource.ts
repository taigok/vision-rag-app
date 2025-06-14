import { defineStorage } from '@aws-amplify/backend';

export const rawFiles = defineStorage({
  name: 'raw-files',
  isDefault: true,
  access: (allow) => ({
    'private/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  }),
});

export const images = defineStorage({
  name: 'images',
  access: (allow) => ({
    'private/*': [allow.authenticated.to(['read', 'write'])],
  }),
});

export const vectorFiles = defineStorage({
  name: 'vector-files',
  versioned: true,
  access: (allow) => ({
    'private/*': [allow.authenticated.to(['read', 'write'])],
  }),
});