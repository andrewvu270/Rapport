import { createWorker } from 'tesseract.js';
import { createServiceClient } from '../../lib/supabase-server';

/**
 * Extracts text from an image stored in Supabase Storage using Tesseract.js OCR
 * @param storagePath - The path to the image in Supabase Storage (format: bucket/path/to/file)
 * @returns Extracted text string
 * @throws Error if OCR fails or image cannot be retrieved
 */
export async function extractTextFromImage(storagePath: string): Promise<string> {
  const supabase = createServiceClient();
  
  try {
    // Parse storage path to extract bucket and file path
    const pathParts = storagePath.split('/');
    if (pathParts.length < 2) {
      throw new Error(`Invalid storage path format: ${storagePath}`);
    }
    
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');
    
    // Download the image from Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);
    
    if (error || !data) {
      throw new Error(`Failed to download image from storage: ${error?.message || 'Unknown error'}`);
    }
    
    // Convert blob to buffer for Tesseract
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Initialize Tesseract worker
    const worker = await createWorker('eng');
    
    try {
      // Perform OCR
      const { data: { text } } = await worker.recognize(buffer);
      
      if (!text || text.trim().length === 0) {
        throw new Error(`No text extracted from image: ${storagePath}`);
      }
      
      return text.trim();
    } finally {
      // Always terminate the worker to free resources
      await worker.terminate();
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OCR extraction failed for ${storagePath}: ${error.message}`);
    }
    throw new Error(`OCR extraction failed for ${storagePath}: Unknown error`);
  }
}
