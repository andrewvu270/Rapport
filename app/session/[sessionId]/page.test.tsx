/**
 * Unit test for session page persona simulation disclaimer
 * 
 * Task 24.2: Write unit test for persona simulation disclaimer
 * Requirements: 10.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useParams, useRouter } from 'next/navigation';
import SessionPage from './page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('SessionPage - Persona Simulation Disclaimer', () => {
  const mockSessionId = 'test-session-id';
  const mockContextId = 'test-context-id';
  const mockPersonCardId = 'test-person-card-id';

  const mockSession = {
    id: mockSessionId,
    status: 'reserved',
    session_type: 'voice',
    person_card_id: mockPersonCardId,
    context_id: mockContextId,
    tavus_persona_status: null,
    started_at: null,
  };

  const mockPersonCard = {
    id: mockPersonCardId,
    participant_name: 'John Doe',
    card_data: {
      participantName: 'John Doe',
      profileSummary: 'Senior Engineer at Tech Corp',
      icebreakers: ['Ask about recent project', 'Discuss tech trends', 'Talk about career path'],
      topicsOfInterest: ['AI', 'Cloud Computing'],
      thingsToAvoid: ['Politics'],
      suggestedAsk: 'Can you share insights about your team?',
      limitedResearch: false,
      generatedAt: new Date().toISOString(),
    },
  };

  const mockContextData = {
    contextId: mockContextId,
    mode: 'professional_networking',
    eventType: 'Conference',
    industry: 'Technology',
    userRole: 'Developer',
    userGoal: 'Network',
    talkingPointsCard: null,
    personCards: [mockPersonCard],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({
      sessionId: mockSessionId,
    });

    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: vi.fn(),
    });

    // Mock fetch responses
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes(`/api/session/${mockSessionId}`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      if (url.includes(`/api/context/${mockContextId}`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockContextData),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('should render persona simulation disclaimer text on pre-session screen', async () => {
    render(<SessionPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Loading session...')).not.toBeInTheDocument();
    });

    // Verify disclaimer heading is present
    expect(screen.getByText('Persona Simulation Disclaimer')).toBeInTheDocument();

    // Verify disclaimer text is present
    expect(
      screen.getByText(/This AI persona is a simulated practice partner for skill development/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/not an impersonation of a real individual/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/does not claim to represent the actual views or behavior of any named person/i)
    ).toBeInTheDocument();
  });

  it('should have "Start Practice" button disabled until disclaimer checkbox is checked', async () => {
    render(<SessionPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Loading session...')).not.toBeInTheDocument();
    });

    // Find the Start Practice button
    const startButton = screen.getByRole('button', { name: /Start Practice/i });

    // Button should be disabled initially
    expect(startButton).toBeDisabled();

    // Find and check the disclaimer checkbox
    const checkbox = screen.getByRole('checkbox', {
      name: /I understand and agree to these terms/i,
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('should enable "Start Practice" button after disclaimer checkbox is checked', async () => {
    const { container } = render(<SessionPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Loading session...')).not.toBeInTheDocument();
    });

    // Find the checkbox and button
    const checkbox = screen.getByRole('checkbox', {
      name: /I understand and agree to these terms/i,
    });
    const startButton = screen.getByRole('button', { name: /Start Practice/i });

    // Initially disabled
    expect(startButton).toBeDisabled();

    // Check the checkbox
    checkbox.click();

    // Wait for state update
    await waitFor(() => {
      expect(startButton).not.toBeDisabled();
    });
  });

  it('should display person card summary on pre-session screen', async () => {
    render(<SessionPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Loading session...')).not.toBeInTheDocument();
    });

    // Verify person card information is displayed
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Senior Engineer at Tech Corp')).toBeInTheDocument();

    // Verify session type badge
    expect(screen.getByText('Voice')).toBeInTheDocument();
  });

  it('should display quick tips from person card', async () => {
    render(<SessionPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Loading session...')).not.toBeInTheDocument();
    });

    // Verify quick tips section
    expect(screen.getByText('Quick Tips')).toBeInTheDocument();
    
    // Should show first 2 icebreakers
    expect(screen.getByText('Ask about recent project')).toBeInTheDocument();
    expect(screen.getByText('Discuss tech trends')).toBeInTheDocument();
  });
});
