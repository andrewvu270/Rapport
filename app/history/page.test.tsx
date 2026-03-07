/**
 * Tests for /history page
 * 
 * Requirements: 7.4, 8.1, 8.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import HistoryPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('HistoryPage', () => {
  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  it('displays empty state when no sessions exist', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          averageScores: {
            openers: 0,
            questionQuality: 0,
            responseRelevance: 0,
            closing: 0,
          },
          sessionCount: 0,
        }),
      });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('No practice sessions yet')).toBeInTheDocument();
    });

    expect(screen.getByText(/Start your first practice session/i)).toBeInTheDocument();
    expect(screen.getByText('Start First Session')).toBeInTheDocument();
  });

  it('displays session list with persona names and session types', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        participantName: 'John Doe',
        sessionType: 'voice',
        status: 'completed',
        created_at: '2024-01-15T10:00:00Z',
        ended_at: '2024-01-15T10:15:00Z',
        retries: [],
      },
      {
        id: 'session-2',
        participantName: 'Jane Smith',
        sessionType: 'video',
        status: 'completed',
        created_at: '2024-01-14T14:00:00Z',
        ended_at: '2024-01-14T14:20:00Z',
        retries: [],
      },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: mockSessions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pending: false,
          report: {
            scores: { openers: 7, questionQuality: 8, responseRelevance: 6, closing: 7 },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pending: false,
          report: {
            scores: { openers: 6, questionQuality: 7, responseRelevance: 8, closing: 6 },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          averageScores: {
            openers: 6.5,
            questionQuality: 7.5,
            responseRelevance: 7.0,
            closing: 6.5,
          },
          sessionCount: 2,
        }),
      });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    expect(screen.getByText('🎤 Voice')).toBeInTheDocument();
    expect(screen.getByText('📹 Video')).toBeInTheDocument();
  });

  it('displays retry sessions indented under parent with attempt labels', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        participantName: 'John Doe',
        sessionType: 'voice',
        status: 'completed',
        created_at: '2024-01-15T10:00:00Z',
        ended_at: '2024-01-15T10:15:00Z',
        retries: [
          {
            id: 'session-1-retry-1',
            participantName: 'John Doe',
            sessionType: 'voice',
            status: 'completed',
            created_at: '2024-01-15T11:00:00Z',
            ended_at: '2024-01-15T11:15:00Z',
            retries: [],
          },
        ],
      },
    ];

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/api/history/progress')) {
        return {
          ok: true,
          json: async () => ({
            averageScores: {
              openers: 7.5,
              questionQuality: 8.5,
              responseRelevance: 6.5,
              closing: 7.5,
            },
            sessionCount: 2,
          }),
        };
      }
      if (url.includes('/api/debrief/')) {
        return {
          ok: true,
          json: async () => ({
            pending: false,
            report: {
              scores: { openers: 8, questionQuality: 9, responseRelevance: 7, closing: 8 },
            },
          }),
        };
      }
      if (url.includes('/api/history')) {
        return {
          ok: true,
          json: async () => ({ sessions: mockSessions }),
        };
      }
      return { ok: false };
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Attempt #2')).toBeInTheDocument();
    });
  });

  it('handles error state gracefully', async () => {
    (global.fetch as any).mockImplementation(async () => {
      throw new Error('Network error');
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });
});
