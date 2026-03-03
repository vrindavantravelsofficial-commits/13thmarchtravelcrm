import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateItineraryHTML } from '@/lib/pdfTemplate';
import { chromium } from 'playwright';
import { existsSync } from 'fs';

// Reuse browser instance for better performance
let browserInstance = null;
let lastUsed = Date.now();
const BROWSER_TIMEOUT = 60000; // Close browser after 60s of inactivity

async function getBrowser() {
  // Cleanup old browser if inactive for too long
  if (browserInstance && Date.now() - lastUsed > BROWSER_TIMEOUT) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
  
  if (!browserInstance) {
    // Check multiple possible Playwright browser paths
    const possiblePaths = [
      '/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
      '/root/.cache/ms-playwright/chromium-1134/chrome-linux/chrome',
      '/root/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
      '/pw-browsers/chromium-1208/chrome-linux/chrome'
    ];
    
    let executablePath;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        executablePath = path;
        break;
      }
    }
    
    browserInstance = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
      ],
      // Faster timeout
      timeout: 30000
    });
  }
  
  lastUsed = Date.now();
  return browserInstance;
}

// Convert snake_case to camelCase for frontend compatibility
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function convertToCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(item => convertToCamel(item))
  
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key)
    // Recursively convert nested objects and arrays
    if (Array.isArray(value)) {
      result[camelKey] = value.map(item => convertToCamel(item))
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      result[camelKey] = convertToCamel(value)
    } else {
      result[camelKey] = value
    }
  }
  return result
}

export async function POST(request) {
  let page = null;
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: 'Supabase admin client not configured.',
          hint: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local.',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { queryId, itineraryId } = body;

    if (!queryId) {
      return NextResponse.json({ error: 'Query ID is required' }, { status: 400 });
    }

    // Fetch all data in parallel for speed
    const [queryResult, orgResult, hotelsResult, transportsResult, activitiesResult, routesResult, packagesResult] = await Promise.all([
      supabaseAdmin.from('queries').select('*').eq('id', queryId).single(),
      supabaseAdmin.from('organizations').select('*').eq('is_default', true).limit(1),
      supabaseAdmin.from('hotels').select('*'),
      supabaseAdmin.from('transports').select('*'),
      supabaseAdmin.from('activities').select('*'),
      supabaseAdmin.from('routes').select('*'),
      supabaseAdmin.from('packages').select('*')
    ]);

    const query = queryResult.data;
    if (queryResult.error || !query) {
      console.error('Query fetch error:', queryResult.error);
      return NextResponse.json({ error: 'Query not found' }, { status: 404 });
    }

    const organization = orgResult.data?.[0] || {};
    const hotels = hotelsResult.data || [];
    const transports = transportsResult.data || [];
    const activities = activitiesResult.data || [];
    const routes = routesResult.data || [];
    const packages = packagesResult.data || [];

    // Get specific itinerary or latest one
    let itinerary;
    if (itineraryId) {
      const { data } = await supabaseAdmin
        .from('itineraries')
        .select('*')
        .eq('id', itineraryId)
        .single();
      itinerary = data;
    } else {
      const { data: itineraries } = await supabaseAdmin
        .from('itineraries')
        .select('*')
        .eq('query_id', queryId)
        .order('created_at', { ascending: false })
        .limit(1);
      itinerary = itineraries?.[0] || null;
    }

    // Fetch quote creator user (for "Your Travel Consultant" on last page)
    let quoteByUser = null;
    const createdById = itinerary?.created_by || null;
    if (createdById) {
      const { data: u } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .eq('id', createdById)
        .single();
      quoteByUser = u || null;
    }

    // Convert all data to camelCase for template compatibility
    const queryData = convertToCamel(query);
    const itineraryData = itinerary ? convertToCamel(itinerary) : null;
    const orgData = convertToCamel(organization);
    const quoteByUserData = quoteByUser ? convertToCamel(quoteByUser) : null;

    // Debug logging for hotel selections
    console.log('[PDF] Hotel selections count:', itineraryData?.hotelSelections?.length || 0);
    if (itineraryData?.hotelSelections) {
      itineraryData.hotelSelections.forEach((h, i) => {
        console.log(`[PDF] Hotel ${i + 1}:`, { 
          hotelId: h.hotelId, 
          hotelName: h.hotelName, 
          hotelLocation: h.hotelLocation,
          nights: h.nights 
        });
      });
    }

    // Find selected package
    const selectedPackage = packages.find(p => p.id === query.tour_package);

    // Generate HTML
    const html = generateItineraryHTML({
      query: queryData,
      itinerary: itineraryData,
      organization: orgData,
      quoteByUser: quoteByUserData,
      selectedPackage: selectedPackage ? convertToCamel(selectedPackage) : null,
      hotels: hotels.map(convertToCamel),
      transports: transports.map(convertToCamel),
      activities: activities.map(convertToCamel),
      routes: routes.map(convertToCamel)
    });

    // Get browser and create page
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Optimize viewport for faster rendering
    await page.setViewportSize({ width: 794, height: 1123 }); // A4 size in pixels
    
    // Set content with minimal wait - just load the DOM
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });

    // Reduce PDF size: re-encode large data-URI images in-browser before printing
    try {
      await page.evaluate(async () => {
        if (typeof window.__optimizeImagesForPdf === 'function') {
          await window.__optimizeImagesForPdf()
        } else {
          window.__pdfImagesOptimized = true
        }
      })
    } catch (e) {
      console.warn('[PDF] Image optimization skipped:', e?.message || e)
    }
    
    // NO waiting for images/fonts - generate immediately for speed
    // The PDF will still render correctly without waiting
    
    // Generate PDF with optimized settings for speed
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
      timeout: 15000
    });

    // Close page but keep browser for reuse
    await page.close();

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="itinerary_${queryData.customerName?.replace(/\s+/g, '_') || 'guest'}.pdf"`,
        'Cache-Control': 'no-store'
      },
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    if (page) {
      await page.close().catch(() => {});
    }
    return NextResponse.json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    }, { status: 500 });
  }
}

// Cleanup browser on process exit
process.on('beforeExit', async () => {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
  }
});
