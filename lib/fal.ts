import { fal } from '@fal-ai/client';

if (process.env.FAL_API_KEY) {
  fal.config({ credentials: process.env.FAL_API_KEY });
}

export { fal };
