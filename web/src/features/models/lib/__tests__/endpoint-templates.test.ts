import { describe, expect, it } from 'vitest'

import { ENDPOINT_TEMPLATES } from '../../constants'

describe('model endpoint templates', () => {
  it('contains every built-in endpoint with its default path', () => {
    expect(ENDPOINT_TEMPLATES).toEqual({
      openai: { path: '/v1/chat/completions', method: 'POST' },
      'openai-response': { path: '/v1/responses', method: 'POST' },
      'openai-response-compact': {
        path: '/v1/responses/compact',
        method: 'POST',
      },
      'openai-alpha-search': { path: '/v1/alpha/search', method: 'POST' },
      anthropic: { path: '/v1/messages', method: 'POST' },
      gemini: {
        path: '/v1beta/models/{model}:generateContent',
        method: 'POST',
      },
      'jina-rerank': { path: '/v1/rerank', method: 'POST' },
      'image-generation': {
        path: '/v1/images/generations',
        method: 'POST',
      },
      embeddings: { path: '/v1/embeddings', method: 'POST' },
      'openai-video': { path: '/v1/videos', method: 'POST' },
    })
  })
})
