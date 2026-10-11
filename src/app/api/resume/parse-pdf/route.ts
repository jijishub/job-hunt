import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';
import { extractText } from 'unpdf';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!await getSessionAccount()) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided. Please upload a PDF resume.' },
        { status: 400 }
      );
    }

    // PDF acceptance only: check mime type and filename extension
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');

    if (!isPdfMime && !isPdfExt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only PDF files (.pdf) are accepted. Please upload a valid PDF document.',
        },
        { status: 400 }
      );
    }

    // Convert file to Uint8Array for unpdf
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    if (uint8Array.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Uploaded PDF file is empty.' },
        { status: 400 }
      );
    }

    const { text, totalPages } = await extractText(uint8Array, { mergePages: true });

    const rawContent = Array.isArray(text) ? text.join('\n\n') : (text || '');
    const cleanText = rawContent
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanText || cleanText.length < 20) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The PDF could not be read or contains scanned images without selectable text. Please upload a text-based PDF resume.',
        },
        { status: 422 }
      );
    }

    // Auto-extract candidate name or headline hint if present
    const firstLines = cleanText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      filename: file.name,
      fileSize: file.size,
      totalPages: totalPages || 1,
      text: cleanText,
      preview: firstLines.join(' • '),
    });
  } catch (error: any) {
    console.error('Error parsing PDF resume:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to extract text from PDF resume.',
      },
      { status: 500 }
    );
  }
}
