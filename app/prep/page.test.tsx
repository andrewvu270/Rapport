import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrepPage from './page';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/prep',
}));

/**
 * Unit tests for /prep page context input form
 * 
 * Requirements: 1.1, 2.4, 9.4, 9.5
 * Task 23.1: Verify all five required fields are present in the rendered form
 */
describe('PrepPage - Context Input Form', () => {
  it('should render all five required context input fields', () => {
    render(<PrepPage />);

    // Verify event type field is present
    expect(screen.getByLabelText(/event type/i)).toBeInTheDocument();

    // Verify industry field is present
    expect(screen.getByLabelText(/industry/i)).toBeInTheDocument();

    // Verify user role field is present
    expect(screen.getByLabelText(/your role/i)).toBeInTheDocument();

    // Verify user goal field is present
    expect(screen.getByLabelText(/your goal/i)).toBeInTheDocument();

    // Verify target people field is present
    expect(screen.getByLabelText(/target people/i)).toBeInTheDocument();
  });
});
