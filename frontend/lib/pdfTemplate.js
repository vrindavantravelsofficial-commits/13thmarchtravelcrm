// PDF Template Generator for Travel Itinerary
// Generates HTML that will be converted to PDF using Puppeteer

import { formatInlineToHtml, formatRichTextToHtml, splitActivityTitleAndDetails } from './richText'

export function generateItineraryHTML(data) {
  const {
    query,
    itinerary,
    organization,
    quoteByUser,
    selectedPackage,
    hotels,
    transports,
    activities,
    routes
  } = data;

  // Helper functions
  const optimizeImageUrlForPdf = (url, { width, height, quality } = {}) => {
    if (!url || typeof url !== 'string') return url
    const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) return trimmed

    try {
      const u = new URL(trimmed)

      // Unsplash optimization
      if (u.hostname.endsWith('images.unsplash.com')) {
        if (width) u.searchParams.set('w', String(width))
        if (quality) u.searchParams.set('q', String(quality))
        u.searchParams.set('auto', 'format')
        u.searchParams.set('fit', 'crop')
        return u.toString()
      }

      // Supabase Storage public object -> render/image (if enabled)
      // object public: /storage/v1/object/public/<bucket>/<path>
      const match = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
      if (match) {
        const bucket = match[1]
        const path = match[2]
        u.pathname = `/storage/v1/render/image/public/${bucket}/${path}`
        u.search = ''
        if (width) u.searchParams.set('width', String(width))
        if (height) u.searchParams.set('height', String(height))
        if (quality) u.searchParams.set('quality', String(quality))
        u.searchParams.set('resize', 'contain')
        return u.toString()
      }

      // Generic: if a URL already supports w/q, set them
      if (width) {
        if (u.searchParams.has('w')) u.searchParams.set('w', String(width))
        if (u.searchParams.has('width')) u.searchParams.set('width', String(width))
      }
      if (quality && u.searchParams.has('q')) u.searchParams.set('q', String(quality))
      return u.toString()
    } catch {
      return trimmed
    }
  }

  const imgOnErrorFallback = (originalUrl) => {
    if (!originalUrl) return ''
    const safe = String(originalUrl).replace(/'/g, "\\'")
    return `this.onerror=null;this.src='${safe}';`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Helper function to format day description with bullet points and bold text
  const formatDayDescription = (description) => {
    if (!description) return '';
    
    // Convert markdown-style bold (**text**) to HTML and markdown-style emphasis
    let html = formatInlineToHtml(description);
    
    // Split by main section separators (- followed by space)
    const sections = html.split(/\s*-\s+/);
    
    if (sections.length <= 1) {
      // No significant structure, return formatted text with line breaks converted to HTML
      return html.replace(/\n/g, '<br/>');
    }
    
    // Build structured list
    let result = '<div class="activity-description">';
    
    sections.forEach((section, idx) => {
      if (idx === 0) {
        // First section - main intro text
        if (section.trim()) {
          result += `<p class="intro-activity">${section.trim()}</p>`;
        }
        return;
      }
      
      const trimmed = section.trim();
      if (!trimmed) return;
      
      // Check if this section contains bullet points (indicated by *)
      const bulletMatch = trimmed.match(/\*\s+/g);
      
      if (bulletMatch && bulletMatch.length > 0) {
        // This section has bullet points
        const subsections = trimmed.split(/\*\s+/).filter(s => s.trim());
        
        result += '<ul class="activity-list">';
        subsections.forEach(item => {
          const cleaned = item
            .replace(/[\*\s]+$/g, '') // Remove trailing asterisks
            .replace(/\n/g, ' ')      // Replace newlines with spaces
            .trim();
          
          if (cleaned) {
            // Highlight the first part (location/temple name) before any further description
            const parts = cleaned.split(/\s+(?:and|or|–|—)/i);
            const highlighted = parts[0].replace(/<strong>([^<]+)<\/strong>/g, '<strong>$1</strong>');
            const remaining = parts.slice(1).join(' ');
            
            result += `<li>${highlighted}${remaining ? ' ' + remaining : ''}</li>`;
          }
        });
        result += '</ul>';
      } else {
        // Regular section with strong heading
        const lines = trimmed.split('\n');
        const firstLine = lines[0].trim();
        const rest = lines.slice(1).map(l => l.trim()).join(' ');
        
        if (firstLine) {
          result += `<div class="activity-section">`;
          result += `<strong>${firstLine}</strong>`;
          if (rest) {
            result += ` ${rest}`;
          }
          result += `</div>`;
        }
      }
    });
    
    result += '</div>';
    return result;
  };

  // Calculate totals
  const nights = parseInt(query?.nights) || 3;
  const totalDays = nights + 1;
  const totalCost = itinerary?.totalCost || 0;
  const subtotal = itinerary?.costs?.subtotal || totalCost;
  const discountAmount = itinerary?.costs?.discountAmount || 0;
  const hasDiscount = discountAmount > 0;

  // Get hotel details with images
  // Uses stored hotelName/hotelLocation as fallback if hotel lookup fails
  const hotelDetails = (itinerary?.hotelSelections || []).filter(h => h.hotelId).map(h => {
    const hotel = hotels?.find(ht => ht.id === h.hotelId);
    // Create a merged hotel object using stored data as fallback
    const mergedHotel = hotel ? { 
      ...hotel,
      // Prefer live data but use stored as fallback
      name: hotel.name || h.hotelName,
      location: hotel.location || h.hotelLocation
    } : {
      // If hotel not found in master data, use stored values
      id: h.hotelId,
      name: h.hotelName || 'Hotel',
      location: h.hotelLocation || 'Location',
      image: h.hotelImage || null,
      starRating: h.starRating || 3
    };
    return { ...h, hotel: mergedHotel };
  });

  // Get transport details
  // Uses stored vehicleType/vehicleName as fallback if transport lookup fails  
  const transportDetails = (itinerary?.transportSelections || []).filter(t => t.transportId).map(t => {
    const transport = transports?.find(tr => tr.id === t.transportId);
    const mergedTransport = transport ? {
      ...transport,
      vehicleType: transport.vehicleType || t.vehicleType,
      vehicleName: transport.vehicleName || t.vehicleName
    } : {
      id: t.transportId,
      vehicleType: t.vehicleType || 'Vehicle',
      vehicleName: t.vehicleName || ''
    };
    return { ...t, transport: mergedTransport };
  });

  // Day plans
  const dayPlans = itinerary?.dayPlans || [];

  // Inclusions and exclusions
  const inclusions = itinerary?.inclusions || [];
  const exclusions = itinerary?.exclusions || [];

  // Extra services
  const extraServices = itinerary?.extraServices || [];

  // Organization info
  const orgName = organization?.name || 'Travel Company';
  const orgPhone = organization?.phone || '+91 XXXXX XXXXX';
  const orgEmail = organization?.email || 'info@company.com';
  const orgAddress = organization?.address || 'Address';
  const orgWebsite = organization?.website || 'www.company.com';
  const orgLogo = organization?.logo || null;
  const orgHeaderImage = organization?.headerImage || null;
  const orgFooterImage = organization?.footerImage || null;
  const orgTermsAndConditions = organization?.termsAndConditions || '';
  const primaryColor = organization?.primaryColor || '#2563eb';
  const pdfTabColor = organization?.pdfTabColor || primaryColor;
  const pdfFontColor = organization?.pdfFontColor || '#ffffff';
  const consultantName = quoteByUser?.name || organization?.consultantName || 'Travel Expert';

  const watermarkHtml = `<div class="watermark">${formatInlineToHtml(orgName)}</div>`;

  // Package info
  const packageName = selectedPackage?.name || query?.destination || 'Tour Package';
  const destination = selectedPackage?.destination || query?.destination || 'Destination';

  // Generate trip ID
  const tripId = query?.queryNumber || 'TRP-00001';

  // Banner image for first page (1200x600)
  const bannerImageOriginal = selectedPackage?.image || 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80';
  const bannerImage = optimizeImageUrlForPdf(bannerImageOriginal, { width: 1200, quality: 70 });

  // Default terms if not set
  const defaultTerms = [
    'Vehicle will be available as per the itinerary. Local use and extra running will be charged separately.',
    'In case of any local restrictions by government/authorities, certain places may remain closed.',
    'Temple timings are subject to change and are beyond our control.',
    'Check-in time is 12:00 PM and check-out time is 10:00 AM at hotels.',
    'The company reserves the right to change/modify the itinerary due to unforeseen circumstances.',
    'AC will work only on plain roads and will be switched off in hilly areas and during waiting.',
    'Seat belts are compulsory for all passengers.',
    'Prices may vary during peak seasons, festivals, and long weekends.',
    'Any changes in government policies, taxes may affect the final cost.',
    'The company is not responsible for any loss due to natural calamities or force majeure events.',
    '50% advance required at the time of booking. Balance amount to be paid before trip commencement.',
    'Cancellation charges will apply as per the cancellation policy.'
  ];

  // Parse terms and conditions
  const termsArray = orgTermsAndConditions 
    ? orgTermsAndConditions.split('\n').filter(t => t.trim())
    : defaultTerms;

  // Common header for pages 2+
  const pageHeader = orgHeaderImage ? `
    <div class="page-header">
      <img src="${optimizeImageUrlForPdf(orgHeaderImage, { width: 1200, height: 60, quality: 70 })}" onerror="${imgOnErrorFallback(orgHeaderImage)}" data-maxw="1200" data-quality="0.65" alt="Header" class="header-image" />
    </div>
  ` : '';

  // Common footer for all pages
  const pageFooter = orgFooterImage ? `
    <div class="page-footer-image">
      <img src="${optimizeImageUrlForPdf(orgFooterImage, { width: 1200, quality: 70 })}" onerror="${imgOnErrorFallback(orgFooterImage)}" data-maxw="1200" data-quality="0.65" alt="Footer" class="footer-image" />
    </div>
  ` : `
    <div class="page-footer">
      <div class="footer-logo">
        ${orgLogo ? `<img src="${optimizeImageUrlForPdf(orgLogo, { width: 120, quality: 70 })}" onerror="${imgOnErrorFallback(orgLogo)}" data-maxw="160" data-quality="0.75" alt="Logo" style="width: 40px; height: 40px;">` : ''}
        <div>
          <div class="footer-company">${orgName}</div>
          <div style="font-size: 12px; color: #888;">Your Travel Partner</div>
        </div>
      </div>
      <div class="footer-contact">
        <div>📞 ${orgPhone}</div>
        <div>✉️ ${orgEmail}</div>
      </div>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${packageName} - Itinerary</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

    @page {
      size: A4;
      margin: 0;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Poppins', sans-serif;
      font-size: 15px;
      line-height: 1.5;
      color: #333;
      background: white;
    }
    
    .page {
      width: 210mm;
      height: 297mm;
      min-height: 297mm;
      padding: 0;
      margin: 0 auto;
      background: white;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }

    .watermark {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-30deg);
      transform-origin: center;
      opacity: 0.06;
      font-size: 64px;
      font-weight: 800;
      color: #000;
      z-index: 0;
      pointer-events: none;
      text-align: center;
      letter-spacing: 1px;
      padding: 0;
      max-width: 100%;
    }

    /* Ensure key containers render above the watermark (without overriding absolute positioning) */
    .page-header,
    .banner,
    .content,
    .content-with-header {
      position: relative;
      z-index: 1;
    }

    .page-footer-image,
    .page-footer {
      z-index: 1;
    }
    
    .page:last-child {
      page-break-after: auto;
    }

    /* Header Image for pages 2+ */
    .page-header {
      width: 100%;
      height: 60px;
      overflow: hidden;
      background: white;
      line-height: 0;
      font-size: 0;
    }
    
    .header-image {
      width: 100%;
      height: 60px;
      object-fit: contain;
      object-position: center;
      background: white;
      display: block;
    }

    /* Footer Image */
    .page-footer-image {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 90px;
      overflow: hidden;
      background: white;
      line-height: 0;
      font-size: 0;
    }
    
    .footer-image {
      width: 100%;
      height: 90px;
      object-fit: cover;
      object-position: center bottom;
      background: white;
      display: block;
    }
    
    /* Content area with header */
    .content-with-header {
      padding: 20px 30px;
      padding-bottom: 90px;
    }
    
    /* Page 1 - Quote Summary - Banner 1200x350 */
    .banner {
      width: 100%;
      height: 350px;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      position: relative;
      display: block;
    }
    
    .banner img {
      width: 100%;
      height: 350px;
      object-fit: cover;
      display: block;
    }
    
    .banner-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6));
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px 30px;
    }
    
    .banner-logo {
      width: 120px;
      height: auto;
    }
    
    .banner-title {
      color: white;
      font-size: 36px;
      font-weight: 700;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      margin-bottom: 10px;
    }
    
    .banner-contact {
      color: white;
      font-size: 15px;
      display: flex;
      gap: 20px;
    }
    
    .content {
      padding: 25px 35px;
    }
    
    .greeting {
      font-size: 17px;
      margin-bottom: 15px;
    }
    
    .greeting-name {
      font-weight: 600;
      color: ${primaryColor};
    }
    
    .intro-text {
      color: #666;
      margin-bottom: 25px;
      font-size: 14px;
    }

    /* PAGE 1 greeting/intro slightly larger */
    .page-quote-summary .greeting {
      font-size: 19.6px; /* 17px * 1.15 */
    }

    .page-quote-summary .intro-text {
      font-size: 16.1px; /* 14px * 1.15 */
    }
    
    .quote-details {
      background: #f8fafc;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 25px;
    }
    
    .quote-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    
    .quote-item {
      padding: 10px;
    }
    
    .quote-label {
      font-size: 13px;
      color: #888;
      text-transform: uppercase;
      font-weight: 500;
      margin-bottom: 4px;
    }
    
    .quote-value {
      font-size: 17px;
      font-weight: 600;
      color: #333;
    }
    
    .price-box {
      background: linear-gradient(135deg, ${pdfTabColor}, #1e40af);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      color: ${pdfFontColor};
      margin-top: 20px;
      max-width: 90%;
      margin-left: auto;
      margin-right: auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .price-breakdown {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      text-align: left;
      font-size: 15px;
    }
    
    .price-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 15px;
    }
    
    .price-row.total {
      font-size: 17px;
      font-weight: 700;
      padding-top: 8px;
      border-top: 2px solid rgba(255, 255, 255, 0.4);
    }
    
    .price-row.discount {
      color: #86efac;
      font-weight: 600;
      background: rgba(134, 239, 172, 0.15);
      padding: 6px 8px;
      border-radius: 4px;
      margin: 8px 0;
    }
    
    .price-label {
      font-size: 14px;
      opacity: 0.95;
      margin-bottom: 4px;
      font-weight: 500;
    }
    
    .price-amount {
      font-size: 40px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -1px;
    }
    
    .price-note {
      font-size: 12px;
      opacity: 0.85;
      margin-top: 4px;
    }
    
    /* Footer for page 1 */
    .page-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: #f1f5f9;
      padding: 15px 35px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 3px solid ${primaryColor};
    }
    
    .footer-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .footer-company {
      font-weight: 600;
      color: ${primaryColor};
    }
    
    .footer-contact {
      text-align: right;
      font-size: 13px;
      color: #666;
    }
    
    /* Section styles */
    .section-header {
      background: ${pdfTabColor};
      color: ${pdfFontColor};
      padding: 12px 20px;
      font-size: 17px;
      font-weight: 600;
      border-radius: 8px 8px 0 0;
      margin-top: 20px;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    
    .section-content {
      border: 1px solid #e2e8f0;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 15px 20px;
      margin-bottom: 15px;
      page-break-inside: avoid;
    }
    
    .section-wrapper {
      page-break-inside: avoid;
      page-break-before: auto;
    }
    
    /* Hotel Card with Image */
    .hotel-card {
      display: flex;
      gap: 15px;
      padding: 15px 0;
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }
    
    .hotel-card:last-child {
      border-bottom: none;
    }

    .hotel-image-container {
      width: 150px;
      height: 100px;
      flex-shrink: 0;
      border-radius: 8px;
      overflow: hidden;
      background: #f1f5f9;
    }

    .hotel-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hotel-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 30px;
    }
    
    .hotel-info {
      flex: 1;
    }
    
    .hotel-name {
      font-size: 21px;
      font-weight: 600;
      color: #333;
      margin-bottom: 5px;
    }
    
    .hotel-location {
      color: #666;
      font-size: 14px;
      margin-bottom: 10px;
    }
    
    .hotel-details-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    
    .hotel-detail {
      background: #f8fafc;
      padding: 8px 10px;
      border-radius: 6px;
    }
    
    .hotel-detail-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
    }
    
    .hotel-detail-value {
      font-size: 15px;
      font-weight: 600;
    }
    
    .star-rating {
      color: #f59e0b;
    }
    
    /* Transport Table */
    .transport-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      page-break-inside: avoid;
    }
    
    .transport-table thead {
      page-break-after: avoid;
    }
    
    .transport-table tr {
      page-break-inside: avoid;
    }
    
    .transport-table th {
      background: #f1f5f9;
      padding: 10px;
      text-align: left;
      font-size: 13px;
      text-transform: uppercase;
      color: #666;
      border-bottom: 2px solid ${primaryColor};
    }
    
    .transport-table td {
      padding: 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }

    /* Page 3: schedule + extra services slightly larger */
    .schedule-page .section-header {
      font-size: 18.7px; /* 17px * 1.10 */
    }

    .schedule-page .section-content {
      font-size: 110%;
    }

    .schedule-page .transport-table th {
      font-size: 14.3px; /* 13px * 1.10 */
    }

    .schedule-page .transport-table td {
      font-size: 15.4px; /* 14px * 1.10 */
    }

    .schedule-page .schedule-route {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .schedule-page .schedule-activities {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .schedule-page .schedule-activities li {
      position: relative;
      padding-left: 14px;
      margin: 2px 0;
      color: #555;
      font-size: 95%;
    }

    .schedule-page .schedule-activities li:before {
      content: "•";
      color: ${primaryColor};
      font-weight: 700;
      position: absolute;
      left: 0;
    }
    
    /* Day Itinerary */
    .day-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
      margin-top: 20px;
    }
    
    .day-number {
      background: ${primaryColor};
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 17px;
    }
    
    .day-date {
      color: #666;
      font-size: 15px;
    }
    
    .day-title {
      font-size: 23px;
      font-weight: 600;
      color: #333;
      margin-bottom: 15px;
    }
    
    .day-image {
      width: 100%;
      height: 256px;
      object-fit: cover;
      border-radius: 10px;
      margin-bottom: 15px;
      display: block;
    }
    
    .day-description {
      color: #555;
      margin-bottom: 15px;
      text-align: justify;
    }

    .day-itinerary-page .day-description {
      font-size: 110%;
    }

    .day-itinerary-page .day-description strong {
      font-size: 110%;
    }
    
    .activity-description {
      margin: 15px 0;
    }
    
    .intro-activity {
      font-size: 14px;
      color: #333;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    
    .intro-activity strong {
      color: #1a1a1a;
      font-weight: 600;
    }
    
    .activity-section {
      margin-bottom: 10px;
      font-size: 14px;
      color: #333;
      line-height: 1.6;
    }
    
    .activity-section strong {
      color: #1a1a1a;
      font-weight: 600;
    }
    
    .activity-list {
      list-style: none;
      padding: 0;
      margin: 12px 0;
    }
    
    .activity-list li {
      position: relative;
      padding-left: 20px;
      font-size: 14px;
      color: #333;
      margin-bottom: 10px;
      line-height: 1.6;
    }
    
    .activity-list li:before {
      content: "▪";
      color: ${primaryColor};
      font-weight: bold;
      position: absolute;
      left: 0;
      font-size: 16px;
    }
    
    .activity-list li strong {
      color: #1a1a1a;
      font-weight: 600;
    }
    
    .activity-list li span {
      color: #555;
    }
    
    .sightseeing-title {
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: 8px;
      font-size: 16.5px;
    }

    .sightseeing-activity-title {
      color: #1a1a1a;
      font-weight: 700;
      font-size: 110%;
    }

    .sightseeing-activity-block {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed rgba(0,0,0,0.08);
    }

    .sightseeing-activity-heading {
      font-size: 13px;
      font-weight: 700;
      color: #333;
      margin-bottom: 6px;
      line-height: 1.35;
    }

    .rt-block {
      margin-top: 2px;
    }

    .rt-line {
      font-size: 12.5px;
      line-height: 1.55;
      color: #444;
      margin: 3px 0;
    }

    .day-itinerary-page .rt-line {
      font-size: 13.75px;
    }

    .rt-line strong {
      color: #1a1a1a;
      font-weight: 700;
    }

    .day-itinerary-page .rt-line strong,
    .day-itinerary-page .rt-bullets li strong {
      font-size: 110%;
    }

    .rt-bullets {
      list-style: none;
      padding: 0;
      margin: 6px 0 0 0;
    }

    .rt-bullets li {
      position: relative;
      padding-left: 14px;
      margin: 3px 0;
      font-size: 12px;
      line-height: 1.45;
      color: #555;
    }

    .day-itinerary-page .rt-bullets li {
      font-size: 13.2px;
    }

    .rt-bullets li:before {
      content: "•";
      color: ${primaryColor};
      font-weight: 700;
      position: absolute;
      left: 0;
      font-size: 1.44em;
      line-height: 1;
    }
    
    .sightseeing-list {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px 15px;
    }
    
    .sightseeing-list li {
      position: relative;
      padding-left: 15px;
      font-size: 13px;
      color: #555;
    }
    
    .sightseeing-list li:before {
      content: "•";
      color: ${primaryColor};
      font-weight: bold;
      position: absolute;
      left: 0;
    }

    /* Backwards-compatible sightseeing grid (used elsewhere) */
    
    .overnight-stay {
      background: #fef3c7;
      padding: 10px 15px;
      border-radius: 6px;
      margin-top: 15px;
      font-size: 14px;
      color: #92400e;
      border-left: 4px solid #f59e0b;
    }
    
    /* Inclusions / Exclusions */
    .inc-exc-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    
    .inc-box, .exc-box {
      border-radius: 10px;
      overflow: hidden;
    }
    
    .inc-header {
      background: #10b981;
      color: white;
      padding: 12px 15px;
      font-weight: 600;
    }
    
    .exc-header {
      background: #ef4444;
      color: white;
      padding: 12px 15px;
      font-weight: 600;
    }
    
    .inc-content, .exc-content {
      padding: 15px;
      background: #f8fafc;
    }
    
    .inc-list, .exc-list {
      list-style: none;
      padding: 0;
    }
    
    .inc-list li, .exc-list li {
      padding: 6px 0;
      padding-left: 20px;
      position: relative;
      font-size: 13px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .inc-list li:last-child, .exc-list li:last-child {
      border-bottom: none;
    }
    
    .inc-list li:before {
      content: "✓";
      color: #10b981;
      position: absolute;
      left: 0;
      font-weight: bold;
    }
    
    .exc-list li:before {
      content: "✗";
      color: #ef4444;
      position: absolute;
      left: 0;
      font-weight: bold;
    }
    
    /* Terms & Conditions */
    .terms-list {
      list-style: none;
      padding: 0;
    }
    
    .terms-list li {
      padding: 8px 0;
      padding-left: 20px;
      position: relative;
      font-size: 13px;
      color: #555;
      border-bottom: 1px solid #f1f5f9;
    }
    
    .terms-list li:before {
      content: "•";
      color: ${primaryColor};
      position: absolute;
      left: 0;
      font-weight: bold;
    }
    
    /* Contact Page */
    .contact-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: calc(297mm - 160px);
      text-align: center;
      padding: 40px;
    }
    
    .contact-logo {
      width: 150px;
      margin-bottom: 30px;
    }
    
    .contact-company {
      font-size: 36px;
      font-weight: 700;
      color: ${primaryColor};
      margin-bottom: 10px;
    }
    
    .contact-tagline {
      color: #888;
      margin-bottom: 40px;
    }
    
    .consultant-card {
      background: linear-gradient(135deg, ${primaryColor}, #1e40af);
      color: white;
      padding: 30px 50px;
      border-radius: 15px;
      margin-bottom: 30px;
    }
    
    .consultant-title {
      font-size: 15px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    
    .consultant-name {
      font-size: 30px;
      font-weight: 600;
    }
    
    .contact-details {
      display: flex;
      gap: 40px;
      margin-top: 30px;
    }
    
    .contact-item {
      text-align: center;
    }
    
    .contact-icon {
      width: 40px;
      height: 40px;
      background: #f1f5f9;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px;
      font-size: 23px;
    }
    
    .contact-value {
      font-weight: 600;
      color: #333;
    }
    
    .contact-label {
      font-size: 13px;
      color: #888;
    }
    
    .thank-you {
      margin-top: 40px;
      font-size: 23px;
      color: ${primaryColor};
      font-weight: 600;
    }
    
    @media print {
      .page {
        margin: 0;
        page-break-after: always;
      }
    }
  </style>
  <script>
    window.__pdfImagesOptimized = false;
    window.__optimizeImagesForPdf = async function () {
      const imgs = Array.from(document.images || []);
      const tasks = imgs.map(async (img) => {
        try {
          const src = img.currentSrc || img.src;
          if (!src || !src.startsWith('data:')) return;

          const maxW = parseInt(img.getAttribute('data-maxw') || '0', 10) || 0;
          const quality = parseFloat(img.getAttribute('data-quality') || '0.72') || 0.72;

          const image = new Image();
          image.src = src;
          await image.decode();

          const naturalW = image.naturalWidth || image.width;
          const naturalH = image.naturalHeight || image.height;
          if (!naturalW || !naturalH) return;

          const scale = maxW && naturalW > maxW ? (maxW / naturalW) : 1;
          const targetW = Math.max(1, Math.round(naturalW * scale));
          const targetH = Math.max(1, Math.round(naturalH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) return;
          ctx.drawImage(image, 0, 0, targetW, targetH);

          const jpeg = canvas.toDataURL('image/jpeg', quality);
          img.src = jpeg;
        } catch (e) {
          // ignore
        }
      });

      await Promise.all(tasks);
      window.__pdfImagesOptimized = true;
    };
  </script>
</head>
<body>

<!-- PAGE 1: Quote Summary (Footer only, no header) -->
<div class="page page-quote-summary">
  ${watermarkHtml}
  <div class="banner">
    <img src="${bannerImage}" onerror="${imgOnErrorFallback(bannerImageOriginal)}" data-maxw="1200" data-quality="0.70" alt="Package Banner" style="width: 100%; height: 350px; object-fit: cover; display: block;" />
  </div>
  
  <div class="content" style="padding-bottom: ${orgFooterImage ? '90px' : '70px'};">
    <div class="greeting">
      Dear <span class="greeting-name">${query?.customerName || 'Valued Guest'}</span>,
    </div>
    <div class="intro-text">
      Thank you for choosing <strong>${orgName}</strong>. We are delighted to present you with a customized travel itinerary for your upcoming trip. 
      We have carefully designed this package keeping your preferences and comfort in mind.
    </div>
    
    <div class="quote-details">
      <div class="quote-grid">
        <div class="quote-item">
          <div class="quote-label">Destination</div>
          <div class="quote-value">${destination}</div>
        </div>
        <div class="quote-item">
          <div class="quote-label">Start Date</div>
          <div class="quote-value">${formatDate(query?.travelDate)}</div>
        </div>
        <div class="quote-item">
          <div class="quote-label">Duration</div>
          <div class="quote-value">${nights} Nights / ${totalDays} Days</div>
        </div>
        <div class="quote-item">
          <div class="quote-label">Travelers</div>
          <div class="quote-value">${query?.adults || 2} Adults${query?.children ? `, ${query.children} Children` : ''}</div>
        </div>
        <div class="quote-item">
          <div class="quote-label">Trip ID</div>
          <div class="quote-value">${tripId}</div>
        </div>
        <div class="quote-item">
          <div class="quote-label">Pick-up / Drop</div>
          <div class="quote-value">${query?.pickUp || 'N/A'} / ${query?.dropOff || 'N/A'}</div>
        </div>
      </div>
    </div>
  </div>
  
  ${pageFooter}
</div>

<!-- PAGE 2: Hotels & Transport (Header + Footer) -->
<div class="page">
  ${watermarkHtml}
  ${pageHeader}
  <div class="content-with-header">
    <div class="section-wrapper">
      <div class="section-header">🏨 Hotels / Accommodations</div>
      <div class="section-content">
      ${hotelDetails.length > 0 ? hotelDetails.map((h, idx) => `
        <div class="hotel-card">
          <div class="hotel-image-container">
            ${h.hotel?.image ? 
              `<img src="${optimizeImageUrlForPdf(h.hotel.image, { width: 450, quality: 65 })}" onerror="${imgOnErrorFallback(h.hotel.image)}" data-maxw="450" data-quality="0.65" class="hotel-image" alt="${h.hotel?.name || 'Hotel'}">` : 
              `<div class="hotel-placeholder">🏨</div>`
            }
          </div>
          <div class="hotel-info">
            <div class="hotel-name">${h.hotel?.name || 'Hotel'}</div>
            <div class="hotel-location">📍 ${h.hotel?.location || 'Location'}</div>
            <div class="hotel-details-grid">
              <div class="hotel-detail">
                <div class="hotel-detail-label">Nights</div>
                <div class="hotel-detail-value">${h.nights || 0}</div>
              </div>
              <div class="hotel-detail">
                <div class="hotel-detail-label">Rooms</div>
                <div class="hotel-detail-value">${h.rooms || 1} ${h.roomType || 'Room'}</div>
              </div>
              <div class="hotel-detail">
                <div class="hotel-detail-label">Meal Plan</div>
                <div class="hotel-detail-value">${h.mealPlan || 'N/A'}</div>
              </div>
              <div class="hotel-detail">
                <div class="hotel-detail-label">Star Rating</div>
                <div class="hotel-detail-value star-rating">${'★'.repeat(h.hotel?.starRating || 3)}${'☆'.repeat(5 - (h.hotel?.starRating || 3))}</div>
              </div>
            </div>
          </div>
        </div>
      `).join('') : '<p style="color: #888; text-align: center; padding: 20px;">No hotel selected</p>'}
    </div>
    </div>
    
    <div class="section-wrapper">
      <div class="section-header">🚗 Transportation</div>
      <div class="section-content">
      ${transportDetails.length > 0 ? `
        <table class="transport-table">
          <thead>
            <tr>
              <th>Vehicle Type</th>
              <th>Vehicle</th>
              <th>Days</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${transportDetails.map(t => `
              <tr>
                <td>${t.vehicleType || t.transport?.vehicleType || 'N/A'}</td>
                <td>${t.vehicleName || t.transport?.vehicleName || 'N/A'}</td>
                <td>${t.days || 0} Days</td>
                <td>${t.quantity || 1}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color: #888; text-align: center; padding: 20px;">No transport selected</p>'}
    </div>
    </div>
    
  </div>
  
  ${pageFooter}
</div>

<!-- PAGE 3: Day-wise Schedule & Extra Services (Header + Footer) -->
<div class="page schedule-page">
  ${watermarkHtml}
  ${pageHeader}
  <div class="content-with-header">
    <div class="section-wrapper">
      <div class="section-header">📋 Day-wise Travel Schedule</div>
      <div class="section-content">
      <table class="transport-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Route / Sightseeing</th>
          </tr>
        </thead>
        <tbody>
          ${dayPlans.map((dp, idx) => `
            <tr>
              <td><strong>${getOrdinal(idx + 1)} Day</strong><br><span style="color: #888; font-size: 12px;">${formatDate(dp.date)}</span></td>
              <td>
                <div class="schedule-route">${formatInlineToHtml(dp.routeTitle || 'Route not specified')}</div>
                ${(dp.activities && dp.activities.length > 0) ? `
                  <ul class="schedule-activities">
                    ${dp.activities
                      .map(a => splitActivityTitleAndDetails(a.name || '', a.description || '').title)
                      .filter(Boolean)
                      .map(t => `<li>${formatInlineToHtml(t)}</li>`)
                      .join('')}
                  </ul>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    </div>
    
    ${extraServices.length > 0 ? `
      <div class="section-wrapper">
        <div class="section-header">⭐ Extra Special Services</div>
        <div class="section-content">
          <table class="transport-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Service</th>
              </tr>
            </thead>
            <tbody>
              ${extraServices.map(s => `
                <tr>
                  <td>Day ${s.day}</td>
                  <td>${s.name || 'Service'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  </div>
  
  ${pageFooter}
</div>

<!-- DAY-WISE ITINERARY PAGES (Header + Footer) -->
${dayPlans.map((dp, idx) => `
<div class="page day-itinerary-page">
  ${watermarkHtml}
  <div class="content-with-header">
    <div class="day-header">
      <div class="day-number">${getOrdinal(idx + 1)} Day</div>
      <div class="day-date">${formatDateShort(dp.date)}</div>
    </div>
    
    <div class="day-title">${dp.routeTitle || `Day ${idx + 1} - Sightseeing`}</div>
    
    ${(dp.activities && dp.activities.length > 0 && dp.activities[0]?.image) ? 
      `<img src="${optimizeImageUrlForPdf(dp.activities[0].image, { width: 1000, quality: 65 })}" onerror="${imgOnErrorFallback(dp.activities[0].image)}" data-maxw="1000" data-quality="0.65" class="day-image" alt="Day ${idx + 1}">` : 
      `<div class="day-image" style="background: linear-gradient(135deg, #e0e7ff, #c7d2fe); display: flex; align-items: center; justify-content: center; color: #6366f1; font-size: 30px;">Day ${idx + 1}</div>`
    }
     
    <div class="day-description">
      ${dp.description ? formatRichTextToHtml(dp.description) : `<p>Enjoy the ${getOrdinal(idx + 1)} day of your trip with amazing sightseeing and experiences. Our guide will ensure you have a memorable journey through the beautiful destinations planned for today.</p>`}
    </div>
    
    ${(dp.activities && dp.activities.length > 0) ? `
      ${(() => {
        const formatted = dp.activities
          .map(act => splitActivityTitleAndDetails(act.name || '', act.description || ''))
          .filter(a => a.title)

        if (formatted.length === 0) return ''

        if (formatted.length === 1) {
          const a = formatted[0]
          return `
            <div class="sightseeing-title">Sightseeing Places / Activities: <span class="sightseeing-activity-title">${formatInlineToHtml(a.title)}</span></div>
            ${a.details ? `<div class="rt">${formatRichTextToHtml(a.details)}</div>` : ''}
          `
        }

        return `
          <div class="sightseeing-title">Sightseeing Places / Activities:</div>
          ${formatted.map((a, i) => `
            <div class="sightseeing-activity-block">
              <div class="sightseeing-activity-heading">${i + 1}. ${formatInlineToHtml(a.title)}</div>
              ${a.details ? formatRichTextToHtml(a.details) : ''}
            </div>
          `).join('')}
        `
      })()}
    ` : ''}
    
    <div class="overnight-stay">
      ${idx === dayPlans.length - 1 ? 
        '🏁 End of trip - Safe journey back home!' : 
        `🌙 Overnight stay at hotel${hotelDetails[0]?.hotel?.location ? ` in ${hotelDetails[0].hotel.location}` : ''}`
      }
    </div>
  </div>
  
  ${pageFooter}
</div>
`).join('')}

<!-- INCLUSIONS / EXCLUSIONS PAGE (Header + Footer) -->
<div class="page">
  ${watermarkHtml}
  ${pageHeader}
  <div class="content-with-header">
    <div class="section-header">📋 Inclusions & Exclusions</div>
    
    <div class="inc-exc-container">
      <div class="inc-box">
        <div class="inc-header">✓ Inclusions</div>
        <div class="inc-content">
          <ul class="inc-list">
            ${inclusions.length > 0 ? inclusions.map(inc => `<li>${inc}</li>`).join('') : `
              <li>Accommodation as per itinerary</li>
              <li>Transportation as mentioned</li>
              <li>Sightseeing as per itinerary</li>
              <li>Toll taxes, parking charges</li>
              <li>Driver allowance</li>
            `}
          </ul>
        </div>
      </div>
      
      <div class="exc-box">
        <div class="exc-header">✗ Exclusions</div>
        <div class="exc-content">
          <ul class="exc-list">
            ${exclusions.length > 0 ? exclusions.map(exc => `<li>${exc}</li>`).join('') : `
              <li>Airfare / Train fare</li>
              <li>Personal expenses</li>
              <li>Entry tickets to monuments</li>
              <li>Meals other than mentioned</li>
              <li>Travel insurance</li>
              <li>GST (as applicable)</li>
            `}
          </ul>
        </div>
      </div>
    </div>
  </div>
  
  ${pageFooter}
</div>

<!-- TERMS & CONDITIONS PAGE (Header + Footer) -->
<div class="page">
  ${watermarkHtml}
  ${pageHeader}
  <div class="content-with-header">
    <div class="section-header">📜 Terms & Conditions</div>
    <div class="section-content">
      <ul class="terms-list">
        ${termsArray.map(term => `<li>${term}</li>`).join('')}
      </ul>
    </div>
  </div>
  
  ${pageFooter}
</div>

<!-- CONTACT PAGE WITH PRICING (Header + Footer) -->
<div class="page">
  ${watermarkHtml}
  ${pageHeader}
  <div class="content-with-header" style="padding-bottom: 90px;">
    
    <!-- TOUR COST SECTION - FIRST CONTENT -->
    <div style="margin-bottom: 30px;">
      <div style="text-align: center; margin-bottom: 15px;">
        <div style="display: inline-block; background: linear-gradient(135deg, ${pdfTabColor}, #1e40af); color: white; padding: 10px 30px; border-radius: 8px; font-size: 24px; font-weight: 700;">
          💰 Tour Package Cost
        </div>
      </div>
      
      <div class="price-box">
        ${hasDiscount ? `
          <div class="price-breakdown">
            <div class="price-row total">
              <span>Total Package Cost</span>
              <span>₹${subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div class="price-row discount">
              <span>💰 Special Discount</span>
              <span>- ₹${discountAmount.toLocaleString('en-IN')}</span>
            </div>
            <div class="price-row total">
              <span>Offer Price</span>
              <span>₹${totalCost.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div class="price-label">Final Package Cost (INR)</div>
          <div class="price-amount">₹${totalCost.toLocaleString('en-IN')}/-</div>
        ` : `
          <div class="price-label">Total Package Cost (INR)</div>
          <div class="price-amount">₹${totalCost.toLocaleString('en-IN')}/-</div>
        `}
        <div class="price-note">(excluding GST)</div>
      </div>
    </div>
    
    <!-- ORGANIZATION DETAILS - BELOW PRICING -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
      <div style="flex: 1;">
        <div class="contact-company" style="text-align: left; font-size: 28px; color: ${pdfTabColor}; font-weight: 700;">${orgName}</div>
        <div style="color: #666; font-size: 14px; margin-top: 5px;">Your Trusted Travel Partner</div>
      </div>
      ${orgLogo ? `<img src="${optimizeImageUrlForPdf(orgLogo, { width: 240, quality: 70 })}" onerror="${imgOnErrorFallback(orgLogo)}" data-maxw="240" data-quality="0.75" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;" alt="Logo">` : ''}
    </div>
    
    <div class="consultant-card" style="background: linear-gradient(135deg, ${pdfTabColor}20, #f0f9ff); padding: 16px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid ${pdfTabColor};">
      <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Your Travel Consultant</div>
      <div style="font-size: 18px; font-weight: 600; color: ${pdfTabColor};">${formatInlineToHtml(consultantName)}</div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
      <div class="contact-item" style="background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 5px;">📞</div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 3px;">${orgPhone}</div>
        <div style="font-size: 11px; color: #888;">Phone</div>
      </div>
      <div class="contact-item" style="background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 5px;">✉️</div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 3px;">${orgEmail}</div>
        <div style="font-size: 11px; color: #888;">Email</div>
      </div>
      <div class="contact-item" style="background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 5px;">📍</div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 3px;">${orgAddress}</div>
        <div style="font-size: 11px; color: #888;">Address</div>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 25px;">
      <div style="font-size: 20px; font-weight: 600; color: ${pdfTabColor}; margin-bottom: 8px;">Thank you for choosing us!</div>
      <div style="color: #888; font-size: 14px;">We look forward to making your trip memorable.</div>
    </div>
  </div>
  
  ${pageFooter}
</div>

</body>
</html>
`;
}
