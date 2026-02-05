/**
 * Fixed Query Bank
 * Same category = same queries every time = consistent results
 * 
 * Each category has exactly 20 curated queries that are:
 * - Realistic (what people actually ask AI)
 * - Diverse (category, comparison, problem, recommendation types)
 * - Consistent (same queries every scan)
 */

export const QUERY_BANK: Record<string, string[]> = {
  "Team communication": [
    "Best team communication tools",
    "Best messaging app for work",
    "Best chat app for remote teams",
    "What team communication tool should I use",
    "Top collaboration tools for businesses",
    "Best internal communication software",
    "Best tools for async communication",
    "Best team chat apps",
    "What messaging platform do companies use",
    "Best communication tools for startups",
    "Best free team communication tools",
    "Enterprise messaging platforms",
    "Best tools for distributed teams",
    "How do remote teams communicate",
    "Best communication tools for small teams",
    "Slack vs Microsoft Teams",
    "Slack alternatives",
    "Microsoft Teams alternatives",
    "Best Slack alternatives",
    "Team messaging apps comparison"
  ],

  "CRM": [
    "Best CRM software",
    "Best CRM for small business",
    "Best CRM for startups",
    "Best free CRM",
    "Top CRM platforms",
    "What CRM should I use",
    "Best CRM for sales teams",
    "Best CRM for B2B",
    "CRM software comparison",
    "Best simple CRM",
    "Best CRM for solopreneurs",
    "Best CRM for agencies",
    "Salesforce alternatives",
    "HubSpot alternatives",
    "Best lightweight CRM",
    "Salesforce vs HubSpot",
    "Best CRM with email integration",
    "Best CRM for small teams",
    "Affordable CRM software",
    "Best CRM for freelancers"
  ],

  "Project management": [
    "Best project management tools",
    "Best project management software",
    "Best project management app for teams",
    "Top project management platforms",
    "What project management tool should I use",
    "Best free project management software",
    "Best project management for startups",
    "Best project management for remote teams",
    "Best simple project management tool",
    "Project management software comparison",
    "Best project management for small business",
    "Best agile project management tools",
    "Asana vs Monday vs Trello",
    "Asana alternatives",
    "Monday.com alternatives",
    "Trello alternatives",
    "Best Kanban tools",
    "Best task management apps",
    "Best project tracking software",
    "Best team task management"
  ],

  "Scheduling": [
    "Best scheduling tools",
    "Best appointment scheduling software",
    "Best meeting scheduler",
    "Best booking software",
    "Best calendar scheduling app",
    "What scheduling tool should I use",
    "Best free scheduling software",
    "Best scheduling for small business",
    "Best scheduling tool for consultants",
    "Best scheduling for freelancers",
    "Calendly alternatives",
    "Best Calendly alternatives",
    "Cal.com vs Calendly",
    "Best open source scheduling",
    "Best scheduling with payment integration",
    "Best scheduling for teams",
    "Best appointment booking app",
    "Best scheduling tool for sales",
    "Meeting scheduling software comparison",
    "Best automated scheduling"
  ],

  "Email marketing": [
    "Best email marketing software",
    "Best email marketing tools",
    "Best email marketing for small business",
    "Best free email marketing",
    "Best email newsletter platform",
    "What email marketing tool should I use",
    "Best email marketing for startups",
    "Best email automation tools",
    "Best email marketing for ecommerce",
    "Email marketing software comparison",
    "Mailchimp alternatives",
    "Best Mailchimp alternatives",
    "ConvertKit vs Mailchimp",
    "Best email marketing for creators",
    "Best email marketing for bloggers",
    "Best transactional email service",
    "Best cold email software",
    "Best email marketing with automation",
    "Best affordable email marketing",
    "Best email marketing for agencies"
  ],

  "Productivity": [
    "Best productivity tools",
    "Best productivity apps",
    "Best productivity software for teams",
    "Best note-taking apps",
    "Best knowledge management tools",
    "Best wiki software for teams",
    "Best documentation tools",
    "Best all-in-one productivity app",
    "Best productivity tools for remote work",
    "Productivity apps comparison",
    "Notion alternatives",
    "Best Notion alternatives",
    "Notion vs Coda vs Obsidian",
    "Best second brain apps",
    "Best tools for PKM",
    "Best workspace software",
    "Best productivity for small teams",
    "Best free productivity tools",
    "Best productivity suite",
    "Best tools for knowledge workers"
  ],

  "Analytics": [
    "Best analytics tools",
    "Best website analytics",
    "Best Google Analytics alternatives",
    "Best privacy-friendly analytics",
    "Best product analytics tools",
    "Best analytics for startups",
    "Best free analytics tools",
    "Best analytics for SaaS",
    "What analytics tool should I use",
    "Analytics software comparison",
    "Mixpanel vs Amplitude",
    "Best simple analytics",
    "Best analytics for small business",
    "Best user behavior analytics",
    "Best analytics dashboard tools",
    "Plausible vs Fathom vs Simple Analytics",
    "Best GDPR compliant analytics",
    "Best analytics without cookies",
    "Best real-time analytics",
    "Best mobile app analytics"
  ],

  "Design": [
    "Best design tools",
    "Best UI design software",
    "Best graphic design tools",
    "Best design tools for non-designers",
    "Best free design software",
    "Best design collaboration tools",
    "What design tool should I use",
    "Best design tools for startups",
    "Design software comparison",
    "Figma alternatives",
    "Best Figma alternatives",
    "Figma vs Sketch vs Adobe XD",
    "Best prototyping tools",
    "Best wireframing tools",
    "Best design system tools",
    "Best tools for web design",
    "Best design tools for developers",
    "Canva alternatives",
    "Best collaborative design software",
    "Best design handoff tools"
  ],

  "Video conferencing": [
    "Best video conferencing software",
    "Best video call apps",
    "Best video meeting tools",
    "Best free video conferencing",
    "Best video conferencing for business",
    "What video call software should I use",
    "Best video conferencing for small teams",
    "Best video conferencing for remote work",
    "Video conferencing comparison",
    "Zoom alternatives",
    "Best Zoom alternatives",
    "Zoom vs Google Meet vs Teams",
    "Best video conferencing with recording",
    "Best video conferencing for webinars",
    "Best secure video conferencing",
    "Best video conferencing for interviews",
    "Best HD video conferencing",
    "Best video conferencing for large meetings",
    "Best browser-based video calls",
    "Best video conferencing with screen share"
  ],

  "Payment processing": [
    "Best payment processing for startups",
    "Best payment gateway",
    "Best payment processor for small business",
    "Best online payment solutions",
    "What payment processor should I use",
    "Best payment processing for SaaS",
    "Best payment gateway for ecommerce",
    "Payment processor comparison",
    "Stripe alternatives",
    "Best Stripe alternatives",
    "Stripe vs PayPal vs Square",
    "Best payment processing fees",
    "Best payment processor for subscriptions",
    "Best payment gateway for international",
    "Best payment processor for marketplace",
    "Best free payment processing",
    "Best payment processor for invoicing",
    "Best payment gateway API",
    "Best payment processing for freelancers",
    "Best recurring payment solutions"
  ],

  "Insurance": [
    "Best insurance companies",
    "Best insurance for small business",
    "Best health insurance providers",
    "Best car insurance companies",
    "What insurance should I get",
    "Best insurance comparison sites",
    "Best affordable insurance",
    "Insurance company reviews",
    "Best insurance for startups",
    "Best insurance for freelancers",
    "Best life insurance companies",
    "Best home insurance providers",
    "Insurance comparison tools",
    "Best digital insurance companies",
    "Best insurance apps",
    "Best insurance customer service",
    "Most reliable insurance companies",
    "Best insurance for families",
    "Insurance provider recommendations",
    "Best comprehensive insurance"
  ],

  "Invoicing": [
    "Best invoicing software",
    "Best free invoicing tools",
    "Best invoicing for freelancers",
    "Best invoicing for small business",
    "What invoicing software should I use",
    "Best invoicing with payment processing",
    "Best simple invoicing app",
    "Invoicing software comparison",
    "Best invoicing for contractors",
    "Best automated invoicing",
    "FreshBooks alternatives",
    "Best FreshBooks alternatives",
    "QuickBooks vs FreshBooks",
    "Best invoicing for agencies",
    "Best recurring invoicing software",
    "Best invoicing with time tracking",
    "Best professional invoicing",
    "Best cloud invoicing software",
    "Best invoicing templates",
    "Best mobile invoicing apps"
  ],

  "Accounting": [
    "Best accounting software",
    "Best accounting for small business",
    "Best free accounting software",
    "Best accounting for startups",
    "What accounting software should I use",
    "Best cloud accounting software",
    "Best accounting for freelancers",
    "Accounting software comparison",
    "QuickBooks alternatives",
    "Best QuickBooks alternatives",
    "Xero vs QuickBooks",
    "Best simple accounting software",
    "Best accounting for ecommerce",
    "Best accounting with invoicing",
    "Best accounting for contractors",
    "Best bookkeeping software",
    "Best accounting for agencies",
    "Best accounting automation",
    "Best accounting for SaaS",
    "Best affordable accounting software"
  ],

  "Customer support": [
    "Best customer support software",
    "Best helpdesk software",
    "Best customer service tools",
    "Best live chat software",
    "Best ticketing system",
    "What customer support tool should I use",
    "Best free helpdesk",
    "Best customer support for startups",
    "Help desk software comparison",
    "Zendesk alternatives",
    "Best Zendesk alternatives",
    "Intercom vs Zendesk",
    "Best customer support for small business",
    "Best omnichannel support software",
    "Best customer support automation",
    "Best knowledge base software",
    "Best chatbot for customer service",
    "Best customer support for SaaS",
    "Best affordable helpdesk",
    "Best customer support with AI"
  ],

  "HR software": [
    "Best HR software",
    "Best HRIS systems",
    "Best HR software for small business",
    "Best free HR software",
    "Best HR management tools",
    "What HR software should I use",
    "Best HR for startups",
    "HR software comparison",
    "Best payroll software",
    "BambooHR alternatives",
    "Best BambooHR alternatives",
    "Gusto vs Rippling",
    "Best HR for remote teams",
    "Best employee management software",
    "Best HR onboarding software",
    "Best HR with payroll",
    "Best people management software",
    "Best HR automation tools",
    "Best affordable HR software",
    "Best all-in-one HR platform"
  ],

  "E-commerce": [
    "Best ecommerce platforms",
    "Best online store builders",
    "Best ecommerce for small business",
    "Best free ecommerce platform",
    "What ecommerce platform should I use",
    "Best ecommerce for startups",
    "Ecommerce platform comparison",
    "Shopify alternatives",
    "Best Shopify alternatives",
    "Shopify vs WooCommerce",
    "Best ecommerce for dropshipping",
    "Best ecommerce for digital products",
    "Best headless ecommerce",
    "Best ecommerce with built-in payments",
    "Best ecommerce for subscriptions",
    "Best simple online store",
    "Best ecommerce for beginners",
    "Best ecommerce themes",
    "Best ecommerce for services",
    "Best enterprise ecommerce"
  ],

  "Marketing automation": [
    "Best marketing automation tools",
    "Best marketing automation for small business",
    "Best free marketing automation",
    "Best marketing automation for startups",
    "What marketing automation should I use",
    "Marketing automation comparison",
    "Best all-in-one marketing platform",
    "HubSpot Marketing alternatives",
    "Best HubSpot alternatives",
    "ActiveCampaign vs HubSpot",
    "Best marketing automation for B2B",
    "Best marketing automation for ecommerce",
    "Best affordable marketing automation",
    "Best marketing automation with CRM",
    "Best lead nurturing software",
    "Best marketing workflow tools",
    "Best campaign management software",
    "Best marketing automation for agencies",
    "Best marketing automation for SaaS",
    "Best simple marketing automation"
  ],

  "Website builder": [
    "Best website builders",
    "Best website builder for small business",
    "Best free website builder",
    "Best website builder for startups",
    "What website builder should I use",
    "Website builder comparison",
    "Best simple website builder",
    "Squarespace alternatives",
    "Best Squarespace alternatives",
    "Wix vs Squarespace vs WordPress",
    "Best website builder for portfolios",
    "Best website builder for blogs",
    "Best no-code website builder",
    "Best website builder for agencies",
    "Best website builder with ecommerce",
    "Best professional website builder",
    "Best website builder for beginners",
    "Best custom website builder",
    "Best website builder for landing pages",
    "Best website builder templates"
  ],

  "Social media management": [
    "Best social media management tools",
    "Best social media scheduler",
    "Best social media tools for small business",
    "Best free social media management",
    "What social media tool should I use",
    "Social media management comparison",
    "Best social media for startups",
    "Buffer alternatives",
    "Best Buffer alternatives",
    "Hootsuite vs Buffer vs Sprout",
    "Best social media analytics",
    "Best social media for agencies",
    "Best social media automation",
    "Best social media for teams",
    "Best Instagram scheduling tools",
    "Best Twitter management tools",
    "Best LinkedIn scheduling",
    "Best social media calendar",
    "Best affordable social media tools",
    "Best all-in-one social media platform"
  ],

  "File storage": [
    "Best cloud storage services",
    "Best file storage for business",
    "Best cloud storage for teams",
    "Best free cloud storage",
    "What cloud storage should I use",
    "Cloud storage comparison",
    "Best secure cloud storage",
    "Dropbox alternatives",
    "Best Dropbox alternatives",
    "Google Drive vs Dropbox vs OneDrive",
    "Best cloud storage for small business",
    "Best cloud storage for collaboration",
    "Best file sharing software",
    "Best enterprise cloud storage",
    "Best cloud storage with sync",
    "Best affordable cloud storage",
    "Best cloud backup services",
    "Best cloud storage for startups",
    "Best encrypted cloud storage",
    "Best cloud storage API"
  ]
};

/**
 * Generate fallback queries for unknown categories
 */
export function generateFallbackQueries(category: string, productName: string): string[] {
  const cat = category.toLowerCase();
  return [
    `Best ${cat} tools`,
    `Best ${cat} software`,
    `Best ${cat} for small business`,
    `Best ${cat} for startups`,
    `Best free ${cat}`,
    `Top ${cat} platforms`,
    `What ${cat} should I use`,
    `Best ${cat} for teams`,
    `${cat} software comparison`,
    `Best simple ${cat}`,
    `Best ${cat} for remote work`,
    `Best ${cat} apps`,
    `${productName} alternatives`,
    `Best ${productName} alternatives`,
    `Is ${productName} good`,
    `${productName} review`,
    `${productName} vs competitors`,
    `Is ${productName} worth it`,
    `Pros and cons of ${productName}`,
    `Best ${cat} like ${productName}`
  ];
}

/**
 * Get queries for a scan - uses fixed query bank for consistency
 * Now supports regional queries for location-specific products
 */
export function getQueriesForScan(
  category: string, 
  productName: string,
  geography?: string
): string[] {
  // Normalize category for lookup (case-insensitive, trim whitespace)
  const normalizedCategory = category.toLowerCase().trim();
  
  // Check if this is a regional product
  const isGlobal = !geography || 
                   geography.toLowerCase() === 'global' || 
                   geography.toLowerCase() === 'worldwide' ||
                   geography.toLowerCase() === 'international';
  
  // Find matching category in query bank
  const matchedCategory = Object.keys(QUERY_BANK).find(
    key => key.toLowerCase() === normalizedCategory
  );
  
  // Try partial matching if no exact match
  const partialMatch = !matchedCategory ? Object.keys(QUERY_BANK).find(key => 
    normalizedCategory.includes(key.toLowerCase()) || 
    key.toLowerCase().includes(normalizedCategory)
  ) : null;
  
  const categoryMatch = matchedCategory || partialMatch;
  
  if (isGlobal) {
    // Use standard queries without region
    if (categoryMatch) {
      console.log(`[QueryBank] Using fixed queries for category: "${categoryMatch}" (Global)`);
      return [...QUERY_BANK[categoryMatch]];
    }
    console.log(`[QueryBank] Unknown category "${category}", generating fallback queries (Global)`);
    return generateFallbackQueries(category, productName);
  }
  
  // Generate region-specific queries
  console.log(`[QueryBank] Generating regional queries for "${category}" in "${geography}"`);
  return generateRegionalQueries(category, productName, geography!, categoryMatch || undefined);
}

/**
 * Generate region-specific queries
 */
function generateRegionalQueries(
  category: string,
  productName: string,
  geography: string,
  knownCategory?: string
): string[] {
  const cat = category.toLowerCase();
  const inRegion = `in ${geography}`;
  const forRegion = `for ${geography}`;
  const regionAdj = getRegionAdjective(geography);
  
  // Mix of regional category queries and product-specific queries
  const queries = [
    // Regional category queries (12)
    `Best ${cat} ${inRegion}`,
    `Best ${cat} ${forRegion} businesses`,
    `Best ${cat} for small business ${inRegion}`,
    `Top ${cat} ${inRegion}`,
    `What ${cat} should I use ${inRegion}`,
    `Best ${cat} for startups ${inRegion}`,
    `${cat} options ${inRegion}`,
    `Most popular ${cat} ${inRegion}`,
    `Best ${cat} for ${regionAdj} companies`,
    `Recommended ${cat} ${forRegion}`,
    `Best free ${cat} ${inRegion}`,
    `${cat} comparison ${inRegion}`,
    
    // Product-specific queries (8)
    `${productName} alternatives`,
    `Best ${productName} alternatives ${inRegion}`,
    `Is ${productName} good`,
    `${productName} review`,
    `${productName} vs competitors`,
    `Is ${productName} the best ${cat} ${inRegion}`,
    `${productName} pros and cons`,
    `Should I use ${productName} ${inRegion}`
  ];
  
  return queries;
}

/**
 * Convert country/region to adjective form
 */
function getRegionAdjective(geography: string): string {
  const adjectives: Record<string, string> = {
    'south africa': 'South African',
    'united kingdom': 'British',
    'uk': 'British',
    'united states': 'American',
    'us': 'American',
    'usa': 'American',
    'germany': 'German',
    'france': 'French',
    'australia': 'Australian',
    'canada': 'Canadian',
    'india': 'Indian',
    'brazil': 'Brazilian',
    'mexico': 'Mexican',
    'japan': 'Japanese',
    'china': 'Chinese',
    'singapore': 'Singaporean',
    'netherlands': 'Dutch',
    'sweden': 'Swedish',
    'norway': 'Norwegian',
    'denmark': 'Danish',
    'finland': 'Finnish',
    'ireland': 'Irish',
    'new zealand': 'New Zealand',
    'spain': 'Spanish',
    'italy': 'Italian',
    'portugal': 'Portuguese',
    'poland': 'Polish',
    'belgium': 'Belgian',
    'austria': 'Austrian',
    'switzerland': 'Swiss',
    'nigeria': 'Nigerian',
    'kenya': 'Kenyan',
    'egypt': 'Egyptian',
    'uae': 'UAE',
    'united arab emirates': 'UAE',
    'saudi arabia': 'Saudi',
    'israel': 'Israeli',
    'thailand': 'Thai',
    'vietnam': 'Vietnamese',
    'philippines': 'Filipino',
    'indonesia': 'Indonesian',
    'malaysia': 'Malaysian',
    // Regions
    'europe': 'European',
    'asia': 'Asian',
    'africa': 'African',
    'latin america': 'Latin American',
    'middle east': 'Middle Eastern',
    'southeast asia': 'Southeast Asian',
    'nordic': 'Nordic',
    'dach': 'DACH region'
  };
  
  return adjectives[geography.toLowerCase()] || geography;
}

/**
 * Get all available categories in the query bank
 */
export function getAvailableCategories(): string[] {
  return Object.keys(QUERY_BANK);
}
