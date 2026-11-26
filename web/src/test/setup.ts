import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest.config.ts runs with `globals: false`, so @testing-library/react's
// automatic afterEach-based cleanup detection doesn't kick in - wire it up
// explicitly so each test starts from an empty document body.
afterEach(() => {
  cleanup();
});
