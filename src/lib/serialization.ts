/**
 * Serialization utilities for NetWork application
 * 
 * These are thin wrappers around JSON.stringify / JSON.parse with error logging
 * as specified in Requirements 9 (Serialization Standard) and 9.7
 */

interface SerializationContext {
  documentType?: string;
  userId?: string;
}

/**
 * Serialize an object to JSON string
 * Logs document type and user ID on failure per Requirement 9.7
 */
export function serialize<T>(obj: T, context?: SerializationContext): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Serialization failed', {
      documentType: context?.documentType,
      userId: context?.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Deserialize a JSON string to an object
 * Logs document type and user ID on failure per Requirement 9.7
 */
export function deserialize<T>(json: string, context?: SerializationContext): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Deserialization failed', {
      documentType: context?.documentType,
      userId: context?.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
