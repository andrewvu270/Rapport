'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /prep page - Context input form
 * 
 * Requirements: 1.1, 2.4, 9.4, 9.5
 * 
 * Allows users to input event context including:
 * - Event type, industry, user role, user goal, target people (required)
 * - URLs, screenshots, plain-text notes (optional)
 * 
 * Displays consent notice modal before intel gathering begins.
 */
export default function PrepPage() {
  const router = useRouter();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [eventType, setEventType] = useState('');
  const [industry, setIndustry] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userGoal, setUserGoal] = useState('');
  const [targetPeople, setTargetPeople] = useState('');
  const [urls, setUrls] = useState('');
  const [plainTextNotes, setPlainTextNotes] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!eventType || !industry || !userRole || !userGoal || !targetPeople) {
      setError('Please fill in all required fields');
      return;
    }

    // Show consent modal before proceeding
    setShowConsentModal(true);
  };

  const handleConsentAccept = async () => {
    setShowConsentModal(false);
    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare context input
      const contextInput = {
        eventType,
        industry,
        userRole,
        userGoal,
        targetPeopleDescription: targetPeople,
        urls: urls ? urls.split('\n').filter(url => url.trim()) : undefined,
        plainTextNotes: plainTextNotes || undefined,
        // Note: Screenshot upload to be implemented with Supabase Storage
        screenshotStoragePaths: screenshots.length > 0 ? [] : undefined,
      };

      // Submit to API
      const response = await fetch('/api/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextInput,
          consentGiven: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create context');
      }

      const { contextId, degradedMode } = await response.json();

      // Navigate to prep results page
      router.push(`/prep/${contextId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  const handleConsentDecline = async () => {
    setShowConsentModal(false);
    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare context input
      const contextInput = {
        eventType,
        industry,
        userRole,
        userGoal,
        targetPeopleDescription: targetPeople,
        urls: urls ? urls.split('\n').filter(url => url.trim()) : undefined,
        plainTextNotes: plainTextNotes || undefined,
        // Note: Screenshot upload to be implemented with Supabase Storage
        screenshotStoragePaths: screenshots.length > 0 ? [] : undefined,
      };

      // Submit to API with consent declined (will enter degraded mode)
      const response = await fetch('/api/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextInput,
          consentGiven: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create context');
      }

      const { contextId } = await response.json();

      // Navigate to prep results page (will show degraded mode banner)
      router.push(`/prep/${contextId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Prepare for Your Event
          </h1>
          <p className="text-gray-600 mb-8">
            Tell us about your networking event and who you'll be meeting.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Type */}
            <div>
              <label
                htmlFor="eventType"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Event Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="eventType"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="e.g., Conference, Networking Mixer, Career Fair"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Industry */}
            <div>
              <label
                htmlFor="industry"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Industry <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Technology, Finance, Healthcare"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Your Role */}
            <div>
              <label
                htmlFor="userRole"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Your Role <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="userRole"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                placeholder="e.g., Software Engineer, Product Manager"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Your Goal */}
            <div>
              <label
                htmlFor="userGoal"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Your Goal <span className="text-red-500">*</span>
              </label>
              <textarea
                id="userGoal"
                value={userGoal}
                onChange={(e) => setUserGoal(e.target.value)}
                placeholder="e.g., Find a mentor in AI, Explore job opportunities"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Target People */}
            <div>
              <label
                htmlFor="targetPeople"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Target People <span className="text-red-500">*</span>
              </label>
              <textarea
                id="targetPeople"
                value={targetPeople}
                onChange={(e) => setTargetPeople(e.target.value)}
                placeholder="Describe who you want to meet (names, roles, companies)"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Optional: URLs */}
            <div>
              <label
                htmlFor="urls"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                URLs (Optional)
              </label>
              <textarea
                id="urls"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="Event page, LinkedIn profiles, company websites (one per line)"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Optional: Screenshot Upload */}
            <div>
              <label
                htmlFor="screenshots"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Screenshots (Optional)
              </label>
              <input
                type="file"
                id="screenshots"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setScreenshots(files);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {screenshots.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {screenshots.length} file(s) selected
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Upload screenshots of event details, LinkedIn profiles, or other relevant information
              </p>
            </div>

            {/* Optional: Plain Text Notes */}
            <div>
              <label
                htmlFor="plainTextNotes"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Additional Notes (Optional)
              </label>
              <textarea
                id="plainTextNotes"
                value={plainTextNotes}
                onChange={(e) => setPlainTextNotes(e.target.value)}
                placeholder="Any additional context or information"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Generate Prep Materials'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Intel Gathering Consent
            </h2>
            <div className="text-gray-700 space-y-4 mb-6">
              <p>
                To provide you with personalized prep materials, NetWork will:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  Search for publicly available information about the people and
                  companies you mentioned
                </li>
                <li>
                  Scrape content from any URLs you provided
                </li>
                <li>
                  Temporarily store this information to generate your prep
                  materials
                </li>
              </ul>
              <p>
                All data will be automatically deleted after 90 days. We only
                use publicly available information and do not claim to represent
                the actual views or behavior of any named person.
              </p>
              <p className="font-medium">
                If you decline, we'll generate prep materials using only the
                information you've directly provided (Degraded Mode).
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleConsentDecline}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-md font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Decline (Use Degraded Mode)
              </button>
              <button
                onClick={handleConsentAccept}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
