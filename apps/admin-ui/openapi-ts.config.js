/** @type {import('@hey-api/openapi-ts').UserConfig} */
export default {
  input: 'src/lib/sdk/openapi.json',
  output: 'src/lib/sdk/generated',
  client: '@hey-api/client-fetch',
  plugins: ['@hey-api/typescript', '@hey-api/sdk'],
};
