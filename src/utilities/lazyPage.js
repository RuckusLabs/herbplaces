import { lazy } from 'react';
import { recoverPageLoad } from './pageLoadRecovery';

export function lazyPage(importPage) {
  return lazy(() => importPage().catch(error => {
    if (recoverPageLoad(error)) {
      // Keep the loading state until the fresh document replaces this one.
      return new Promise(() => {});
    }
    throw error;
  }));
}
