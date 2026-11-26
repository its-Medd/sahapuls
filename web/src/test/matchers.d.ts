import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
declare module 'vitest' {
  // Declaration merging extends Vitest 5's public matcher interface.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<R, T> {}
}
