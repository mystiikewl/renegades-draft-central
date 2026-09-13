import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { router } from './router';

describe('route loading', () => {
  it('shows a status message while a lazy page is loading', () => {
    const PendingComponent = router.options.defaultPendingComponent;

    expect(PendingComponent).toBeDefined();
    if (!PendingComponent) throw new Error('Expected the router to provide a pending component.');
    render(<PendingComponent />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading page');
  });
});
