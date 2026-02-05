import OpenAI from "openai"

// Lazy initialization
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

// ============================================================
// INDUSTRY-SPECIFIC COMPETITOR DATABASES
// Known competitors by industry and region for fallback/validation
// ============================================================

interface RegionalCompetitors {
  global: string[]
  [countryCode: string]: string[]
}

const INDUSTRY_COMPETITORS: Record<string, RegionalCompetitors> = {
  // Payment Gateways / Fintech
  fintech: {
    global: ["Stripe", "PayPal", "Square", "Adyen", "Braintree", "Worldpay", "Checkout.com"],
    ZA: ["PayFast", "Yoco", "Peach Payments", "iKhokha", "SnapScan", "Zapper", "Ozow", "PayGate"],
    NG: ["Paystack", "Flutterwave", "Interswitch", "Remita", "Paga"],
    KE: ["M-Pesa", "Pesapal", "Cellulant", "DPO Group"],
    IN: ["Razorpay", "Paytm", "PhonePe", "BillDesk", "CCAvenue", "PayU India"],
    BR: ["PagSeguro", "Stone", "Cielo", "Mercado Pago", "PicPay"],
    DE: ["Klarna", "N26", "SumUp", "Wirecard"],
    UK: ["Wise", "Revolut", "GoCardless", "SumUp UK", "Zettle"],
    AU: ["Afterpay", "Zip", "Tyro", "Square AU", "Airwallex"],
  },
  
  // Insurance
  insurance: {
    global: ["Allianz", "AXA", "Zurich", "MetLife", "Prudential"],
    ZA: ["Santam", "Discovery", "Old Mutual", "Outsurance", "Hollard", "MiWay", "1st for Women", "King Price"],
    US: ["State Farm", "Geico", "Progressive", "Allstate", "Liberty Mutual", "USAA"],
    UK: ["Aviva", "Admiral", "Direct Line", "LV=", "Legal & General", "Hastings"],
    DE: ["Allianz", "ERGO", "HUK-Coburg", "Debeka", "R+V", "AXA Germany"],
    AU: ["NRMA", "RACV", "Suncorp", "QBE", "Allianz Australia", "Budget Direct"],
    IN: ["LIC", "HDFC Life", "ICICI Prudential", "SBI Life", "Max Life"],
  },
  
  // Banking
  banking: {
    global: ["HSBC", "Citi", "JPMorgan Chase", "Bank of America", "Deutsche Bank"],
    ZA: ["FNB", "Standard Bank", "Absa", "Nedbank", "Capitec", "African Bank", "TymeBank"],
    US: ["Chase", "Bank of America", "Wells Fargo", "Citi", "Capital One", "US Bank"],
    UK: ["Barclays", "HSBC UK", "Lloyds", "NatWest", "Santander UK", "Monzo", "Starling"],
    DE: ["Deutsche Bank", "Commerzbank", "DKB", "ING Germany", "Sparkasse", "N26"],
    AU: ["Commonwealth Bank", "ANZ", "Westpac", "NAB", "Macquarie", "ING Australia"],
    IN: ["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak Mahindra"],
  },
  
  // Car Rental
  car_rental: {
    global: ["Hertz", "Avis", "Enterprise", "Budget", "National", "Europcar", "Sixt"],
    ZA: ["Avis South Africa", "Europcar South Africa", "Budget South Africa", "First Car Rental", "Tempest", "Bidvest"],
    US: ["Enterprise", "Hertz", "Avis", "Budget", "National", "Dollar", "Thrifty", "Alamo"],
    UK: ["Enterprise UK", "Hertz UK", "Avis UK", "Europcar UK", "Arnold Clark", "Green Motion"],
    DE: ["Sixt", "Europcar Germany", "Starcar", "Buchbinder", "Enterprise Germany"],
    AU: ["Avis Australia", "Budget Australia", "Hertz Australia", "Thrifty", "East Coast Car Rentals"],
  },
  
  // Healthcare
  healthcare: {
    global: ["Mayo Clinic", "Cleveland Clinic", "Johns Hopkins"],
    ZA: ["Netcare", "Mediclinic", "Life Healthcare", "Intercare", "Lenmed"],
    US: ["Kaiser Permanente", "UnitedHealth", "HCA Healthcare", "Ascension"],
    UK: ["NHS", "Bupa", "Nuffield Health", "Spire Healthcare"],
    DE: ["Charité", "Helios", "Asklepios", "Rhön-Klinikum"],
    AU: ["Ramsay Health Care", "Healthscope", "St Vincent's", "Epworth"],
  },
  
  // E-commerce
  ecommerce: {
    global: ["Amazon", "eBay", "Alibaba", "Shopify stores"],
    ZA: ["Takealot", "Makro", "Game", "Superbalist", "Zando", "Bob Shop"],
    US: ["Amazon", "Walmart", "Target", "Best Buy", "Wayfair", "Etsy"],
    UK: ["Amazon UK", "Argos", "John Lewis", "Currys", "Very", "AO.com"],
    DE: ["Amazon.de", "Otto", "Zalando", "MediaMarkt", "Saturn"],
    AU: ["Amazon Australia", "Kogan", "JB Hi-Fi", "The Iconic", "Catch"],
    IN: ["Flipkart", "Amazon India", "Myntra", "Snapdeal", "Paytm Mall"],
  },
  
  // Fitness
  fitness: {
    global: ["Planet Fitness", "Gold's Gym", "Anytime Fitness", "LA Fitness"],
    ZA: ["Virgin Active", "Planet Fitness SA", "Ignite Fitness", "Zone Fitness", "CrossFit SA gyms"],
    US: ["Planet Fitness", "LA Fitness", "24 Hour Fitness", "Equinox", "Orange Theory"],
    UK: ["PureGym", "The Gym Group", "David Lloyd", "Virgin Active UK", "Nuffield Health"],
    DE: ["McFit", "FitX", "Fitness First Germany", "clever fit"],
    AU: ["Fitness First", "Anytime Fitness AU", "F45", "Plus Fitness", "Jetts"],
  },
  
  // Telecom
  telecom: {
    global: ["Vodafone", "T-Mobile", "AT&T"],
    ZA: ["Vodacom", "MTN", "Cell C", "Telkom", "Rain"],
    US: ["Verizon", "AT&T", "T-Mobile", "Sprint", "US Cellular"],
    UK: ["EE", "Vodafone UK", "O2", "Three", "Virgin Mobile UK"],
    DE: ["Telekom", "Vodafone Germany", "O2 Germany", "1&1"],
    AU: ["Telstra", "Optus", "Vodafone Australia", "TPG"],
    IN: ["Jio", "Airtel", "Vi (Vodafone Idea)", "BSNL"],
  },
  
  // Retail / Apparel
  retail: {
    global: ["Nike", "Adidas", "Zara", "H&M", "Uniqlo"],
    ZA: ["Woolworths", "Mr Price", "Truworths", "Foschini", "Edgars", "Cotton On SA"],
    US: ["Nike", "Lululemon", "Gap", "Old Navy", "American Eagle", "Nordstrom"],
    UK: ["Marks & Spencer", "Next", "ASOS", "Primark", "River Island"],
    DE: ["Zalando", "About You", "Peek & Cloppenburg", "C&A"],
    AU: ["Cotton On", "Country Road", "David Jones", "Myer", "The Iconic"],
  },
}

/**
 * Validate and enrich competitor list based on industry and location
 */
function validateAndEnrichCompetitors(
  discoveredCompetitors: string[],
  industryType: string | null,
  detectedCountry: string | null,
  countryCode: string | null,
  isLocationBound: boolean,
  brandName: string
): string[] {
  const brandLower = brandName.toLowerCase()
  
  // Remove the scanned brand from competitors
  let competitors = discoveredCompetitors.filter(
    comp => comp.toLowerCase() !== brandLower && 
            !comp.toLowerCase().includes(brandLower) &&
            brandLower.length > 2 && !brandLower.includes(comp.toLowerCase())
  )
  
  // Get industry-specific competitors
  const industry = industryType?.toLowerCase() || ""
  const industryCompetitors = INDUSTRY_COMPETITORS[industry]
  
  if (industryCompetitors) {
    // Get global competitors
    const globalComps = industryCompetitors.global || []
    
    // Get regional competitors if location-bound
    const regionalComps = (countryCode && industryCompetitors[countryCode]) 
      ? industryCompetitors[countryCode] 
      : []
    
    // If location-bound, prioritize regional competitors
    if (isLocationBound && regionalComps.length > 0) {
      console.log(`[Competitors] Adding ${regionalComps.length} regional competitors for ${countryCode}`)
      
      // Add regional competitors that aren't already in the list
      const existingLower = new Set(competitors.map(c => c.toLowerCase()))
      const newRegional = regionalComps.filter(
        c => !existingLower.has(c.toLowerCase()) && c.toLowerCase() !== brandLower
      )
      
      // Put regional competitors first
      competitors = [...newRegional, ...competitors]
    }
    
    // Add global competitors that might be missing
    const existingLower = new Set(competitors.map(c => c.toLowerCase()))
    const newGlobal = globalComps.filter(
      c => !existingLower.has(c.toLowerCase()) && c.toLowerCase() !== brandLower
    )
    
    // Add some global competitors at the end (not too many to overwhelm regional ones)
    const globalToAdd = isLocationBound ? newGlobal.slice(0, 3) : newGlobal.slice(0, 5)
    competitors = [...competitors, ...globalToAdd]
  }
  
  // Remove duplicates (case-insensitive)
  const seen = new Set<string>()
  competitors = competitors.filter(c => {
    const lower = c.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
  
  // Limit to reasonable number
  const finalCompetitors = competitors.slice(0, 15)
  
  console.log(`[Competitors] Final list (${finalCompetitors.length}): ${finalCompetitors.join(", ")}`)
  
  return finalCompetitors
}

/**
 * Make a targeted AI call to discover location-specific competitors
 * Used when we need more regional competitors for location-bound services
 */
async function discoverRegionalCompetitors(
  category: string,
  industryType: string | null,
  country: string,
  brandName: string,
  existingCompetitors: string[]
): Promise<string[]> {
  const client = getOpenAIClient()
  if (!client) return []
  
  try {
    const prompt = `List the top 10 ${category} companies/brands that operate in ${country}.
    
IMPORTANT:
- ONLY include companies that are available in ${country}
- Include both local ${country} companies AND international companies that serve ${country}
- Put LOCAL ${country} companies FIRST in the list
- Do NOT include: ${brandName}
- Already known: ${existingCompetitors.slice(0, 5).join(", ")}

Respond with ONLY a JSON array of company names, no explanation:
["Company1", "Company2", "Company3", ...]`

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    })

    const responseContent = completion.choices[0]?.message?.content || "[]"
    
    // Extract JSON array
    const jsonMatch = responseContent.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const competitors = JSON.parse(jsonMatch[0]) as string[]
      console.log(`[Regional Discovery] Found ${competitors.length} competitors for ${country}`)
      return competitors.filter(c => 
        c.toLowerCase() !== brandName.toLowerCase() &&
        !existingCompetitors.some(e => e.toLowerCase() === c.toLowerCase())
      )
    }
    
    return []
  } catch (error) {
    console.error("[Regional Discovery] Failed:", error)
    return []
  }
}

// Content Strategy Recommendation
export interface ContentRecommendation {
  id: string
  priority: "high" | "medium" | "low"
  category: "content" | "technical" | "authority" | "positioning"
  title: string
  description: string
  impact: string // Why this matters for AI visibility
  action: string // Specific action to take
  example?: string // Example of how to implement
}

// Page Analysis Result
export interface PageAnalysis {
  url: string
  pageType: "homepage" | "about" | "features" | "pricing" | "comparison" | "faq" | "blog" | "other"
  title: string
  metaDescription: string | null
  headings: string[]
  keyContent: string[]
  hasSchema: boolean
  schemaTypes: string[]
}

// Content Strategy Analysis
export interface ContentStrategyAnalysis {
  // What content exists
  pagesAnalyzed: PageAnalysis[]
  hasComparisonPages: boolean
  hasFAQSection: boolean
  hasFAQSchema: boolean
  hasProductSchema: boolean
  hasCaseStudies: boolean
  hasTestimonials: boolean
  hasPricingPage: boolean
  hasIntegrations: boolean
  hasBlogContent: boolean
  
  // Content quality signals
  valuePropositionClarity: "clear" | "somewhat_clear" | "unclear"
  uniqueDifferentiators: string[]
  categoryPositioning: string | null // How they position in their category
  
  // Authority signals found on site
  authoritySignals: {
    reviewPlatformLinks: string[] // G2, Capterra, etc.
    pressmentions: string[]
    awards: string[]
    partnerLogos: string[]
    customerLogos: string[]
    socialProofStats: string[] // "10,000+ customers", etc.
  }
  
  // What's missing (opportunities)
  missingContent: string[]
  
  // AI visibility recommendations
  recommendations: ContentRecommendation[]
}

export interface URLAnalysisResult {
  // Extracted from website
  extractedKeywords: string[]
  extractedFeatures: string[]
  extractedCategory: string | null
  extractedDescription: string | null
  targetAudience: string | null
  useCases: string[]
  pricingModel: string | null
  
  // Discovered competitors based on analysis
  discoveredCompetitors: string[]
  
  // Location/region detection for geo-specific services
  detectedCountry: string | null // e.g., "Germany", "United States", "United Kingdom"
  detectedCountryCode: string | null // e.g., "DE", "US", "UK"
  isLocationBound: boolean // True if service is region-specific (insurance, banking, healthcare, etc.)
  
  // NEW: AI-assisted industry classification
  industryType: string | null // e.g., "healthcare", "fintech", "car_rental", "fitness", "insurance"
  productType: "physical" | "software" | "service" | null // What type of product/service is this?
  industryTerminology: {
    singular: string // e.g., "provider", "tool", "brand", "agency"
    plural: string // e.g., "providers", "tools", "brands", "agencies"
    verbPhrase: string // e.g., "use", "buy", "hire", "sign up with"
  } | null
  
  // NEW: Deep content strategy analysis
  contentStrategy: ContentStrategyAnalysis | null
  
  // Confidence in the analysis
  confidence: number
  
  // Raw content for debugging
  scrapedContent?: string
}

/**
 * Fetch and analyze the content of a URL to extract product information
 * Now includes deep crawling of multiple pages and content strategy analysis
 * Has a 25-second overall timeout to allow for multi-page crawling
 */
export async function analyzeURL(url: string, deepCrawl: boolean = true): Promise<URLAnalysisResult | null> {
  // Create an overall timeout for URL analysis (reduced for faster scans)
  // Deep crawl: 18 seconds (was 25), Basic: 10 seconds (was 15)
  const timeoutMs = deepCrawl ? 18000 : 10000
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.log(`URL analysis timed out after ${timeoutMs / 1000} seconds`)
      resolve(null)
    }, timeoutMs)
  })

  const analysisPromise = (async () => {
    try {
      // Normalize URL
      let normalizedUrl = url
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl
      }
      
      // Step 1: Fetch homepage content
      const homepageContent = await fetchWebsiteContent(normalizedUrl)
      
      if (!homepageContent || homepageContent.content.length < 100) {
        console.log("Could not fetch enough content from URL:", url)
        return null
      }

      // Step 1.5: Detect location/country from URL and content
      const locationInfo = detectLocation(normalizedUrl, homepageContent.content, homepageContent.html)
      console.log(`Location detection: ${locationInfo.country || 'Global'} (${locationInfo.countryCode || 'N/A'}), Location-bound: ${locationInfo.isLocationBound}`)

      // Step 2: Deep crawl additional pages (if enabled)
      let additionalPages: PageAnalysis[] = []
      if (deepCrawl) {
        const discoveredUrls = discoverInternalLinks(homepageContent.html, normalizedUrl)
        console.log(`Discovered ${discoveredUrls.length} internal pages to analyze`)
        
        // Fetch up to 3 additional key pages in parallel (reduced from 5 for speed)
        const pagesToFetch = discoveredUrls.slice(0, 3)
        const pagePromises = pagesToFetch.map(pageUrl => 
          fetchAndAnalyzePage(pageUrl).catch(() => null)
        )
        
        const pageResults = await Promise.all(pagePromises)
        additionalPages = pageResults.filter((p): p is PageAnalysis => p !== null)
        console.log(`Successfully analyzed ${additionalPages.length} additional pages`)
      }

      // Step 3: Analyze content strategy across all pages
      const contentStrategy = analyzeContentStrategy(homepageContent, additionalPages)

      // Step 4: Use AI to analyze the combined content (pass location for competitor discovery)
      const combinedContent = [
        homepageContent.content,
        ...additionalPages.map(p => `\n--- ${p.pageType.toUpperCase()} PAGE ---\n${p.keyContent.join("\n")}`)
      ].join("\n")
      
      const analysis = await analyzeContentWithAI(
        combinedContent.slice(0, 12000), 
        normalizedUrl,
        locationInfo.country, // Pass detected country for location-specific competitor discovery
        locationInfo.isLocationBound
      )
      
      if (analysis) {
        // Add location info to the result
        analysis.detectedCountry = locationInfo.country
        analysis.detectedCountryCode = locationInfo.countryCode
        analysis.isLocationBound = locationInfo.isLocationBound
        
        // Validate and enrich competitors based on industry and location
        // Extract brand name from URL for filtering
        const urlObj = new URL(normalizedUrl)
        const brandFromUrl = urlObj.hostname.replace(/^www\./, '').split('.')[0]
        
        // First pass: validate and enrich with known competitors
        let enrichedCompetitors = validateAndEnrichCompetitors(
          analysis.discoveredCompetitors,
          analysis.industryType,
          locationInfo.country,
          locationInfo.countryCode,
          locationInfo.isLocationBound,
          brandFromUrl
        )
        
        // If location-bound and we have very few competitors, try to discover more regional ones
        // Only do this if we have less than 5 competitors (to save time)
        if (locationInfo.isLocationBound && locationInfo.country && enrichedCompetitors.length < 5) {
          console.log(`[Competitors] Only ${enrichedCompetitors.length} competitors, discovering more for ${locationInfo.country}...`)
          
          const category = analysis.extractedCategory || analysis.industryType || "services"
          const regionalCompetitors = await discoverRegionalCompetitors(
            category,
            analysis.industryType,
            locationInfo.country,
            brandFromUrl,
            enrichedCompetitors
          )
          
          if (regionalCompetitors.length > 0) {
            // Add new regional competitors at the beginning
            const existingLower = new Set(enrichedCompetitors.map(c => c.toLowerCase()))
            const newRegional = regionalCompetitors.filter(c => !existingLower.has(c.toLowerCase()))
            enrichedCompetitors = [...newRegional.slice(0, 5), ...enrichedCompetitors].slice(0, 15)
            console.log(`[Competitors] Added ${newRegional.length} new regional competitors`)
          }
        }
        
        analysis.discoveredCompetitors = enrichedCompetitors
        
        // Add content strategy to the result
        analysis.contentStrategy = contentStrategy
        
        // Generate AI visibility recommendations based on content strategy
        const recommendations = generateAIVisibilityRecommendations(contentStrategy, analysis)
        if (analysis.contentStrategy) {
          analysis.contentStrategy.recommendations = recommendations
        }
      }
      
      return analysis
    } catch (error) {
      console.error("URL analysis failed:", error)
      return null
    }
  })()

  // Race between analysis and timeout
  return Promise.race([analysisPromise, timeoutPromise])
}

/**
 * Country code to country name mapping for common TLDs
 */
const TLD_COUNTRY_MAP: Record<string, { country: string; code: string }> = {
  // Europe
  'de': { country: 'Germany', code: 'DE' },
  'uk': { country: 'United Kingdom', code: 'UK' },
  'co.uk': { country: 'United Kingdom', code: 'UK' },
  'org.uk': { country: 'United Kingdom', code: 'UK' },
  'fr': { country: 'France', code: 'FR' },
  'es': { country: 'Spain', code: 'ES' },
  'it': { country: 'Italy', code: 'IT' },
  'nl': { country: 'Netherlands', code: 'NL' },
  'be': { country: 'Belgium', code: 'BE' },
  'at': { country: 'Austria', code: 'AT' },
  'ch': { country: 'Switzerland', code: 'CH' },
  'pl': { country: 'Poland', code: 'PL' },
  'se': { country: 'Sweden', code: 'SE' },
  'no': { country: 'Norway', code: 'NO' },
  'dk': { country: 'Denmark', code: 'DK' },
  'fi': { country: 'Finland', code: 'FI' },
  'pt': { country: 'Portugal', code: 'PT' },
  'ie': { country: 'Ireland', code: 'IE' },
  'ru': { country: 'Russia', code: 'RU' },
  // Asia Pacific
  'au': { country: 'Australia', code: 'AU' },
  'com.au': { country: 'Australia', code: 'AU' },
  'nz': { country: 'New Zealand', code: 'NZ' },
  'co.nz': { country: 'New Zealand', code: 'NZ' },
  'jp': { country: 'Japan', code: 'JP' },
  'co.jp': { country: 'Japan', code: 'JP' },
  'kr': { country: 'South Korea', code: 'KR' },
  'co.kr': { country: 'South Korea', code: 'KR' },
  'cn': { country: 'China', code: 'CN' },
  'com.cn': { country: 'China', code: 'CN' },
  'in': { country: 'India', code: 'IN' },
  'co.in': { country: 'India', code: 'IN' },
  'sg': { country: 'Singapore', code: 'SG' },
  'com.sg': { country: 'Singapore', code: 'SG' },
  'hk': { country: 'Hong Kong', code: 'HK' },
  'com.hk': { country: 'Hong Kong', code: 'HK' },
  // Americas
  'ca': { country: 'Canada', code: 'CA' },
  'br': { country: 'Brazil', code: 'BR' },
  'com.br': { country: 'Brazil', code: 'BR' },
  'mx': { country: 'Mexico', code: 'MX' },
  'com.mx': { country: 'Mexico', code: 'MX' },
  // Africa
  'za': { country: 'South Africa', code: 'ZA' },
  'co.za': { country: 'South Africa', code: 'ZA' },
  'org.za': { country: 'South Africa', code: 'ZA' },
  'ng': { country: 'Nigeria', code: 'NG' },
  'com.ng': { country: 'Nigeria', code: 'NG' },
  'ke': { country: 'Kenya', code: 'KE' },
  'co.ke': { country: 'Kenya', code: 'KE' },
  'eg': { country: 'Egypt', code: 'EG' },
  'com.eg': { country: 'Egypt', code: 'EG' },
  // Middle East
  'ae': { country: 'United Arab Emirates', code: 'AE' },
  'co.ae': { country: 'United Arab Emirates', code: 'AE' },
  'sa': { country: 'Saudi Arabia', code: 'SA' },
  'com.sa': { country: 'Saudi Arabia', code: 'SA' },
  'il': { country: 'Israel', code: 'IL' },
  'co.il': { country: 'Israel', code: 'IL' },
}

/**
 * Categories that are typically location-bound (require geo-specific queries)
 */
const LOCATION_BOUND_CATEGORIES = [
  // Financial services
  'insurance', 'health insurance', 'car insurance', 'life insurance', 'home insurance',
  'bank', 'banking', 'credit union', 'mortgage', 'loan', 'credit card',
  'investment', 'wealth management', 'financial advisor', 'tax', 'accounting',
  // Payment/Fintech (often region-specific due to regulations)
  'payment gateway', 'payment processor', 'payment solution', 'fintech', 'payments',
  'online payments', 'card payments', 'merchant services', 'payment provider',
  // Healthcare
  'healthcare', 'health care', 'hospital', 'clinic', 'doctor', 'dentist', 'medical',
  'pharmacy', 'pharmaceutical', 'health provider', 'krankenkasse', 'krankenversicherung',
  // Legal
  'lawyer', 'attorney', 'legal', 'law firm', 'notary',
  // Government/Public services
  'government', 'public service', 'municipality', 'city service',
  // Telecom
  'telecom', 'mobile carrier', 'internet provider', 'isp', 'phone carrier',
  // Utilities
  'utility', 'electricity', 'gas provider', 'water', 'energy provider',
  // Real estate
  'real estate', 'property', 'housing', 'apartment', 'immobilien',
  // Education
  'university', 'college', 'school', 'education',
  // Local services
  'local service', 'delivery', 'moving', 'plumber', 'electrician', 'contractor',
]

/**
 * Detect location/country from URL TLD and content
 */
function detectLocation(url: string, content: string, html: string): {
  country: string | null
  countryCode: string | null
  isLocationBound: boolean
} {
  let detectedCountry: string | null = null
  let detectedCountryCode: string | null = null
  let isLocationBound = false
  
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.toLowerCase()
    
    // Check for country-code TLD
    const tldParts = hostname.split('.')
    const tld = tldParts[tldParts.length - 1]
    const secondLevelTld = tldParts.length >= 2 ? `${tldParts[tldParts.length - 2]}.${tld}` : null
    
    // Check second-level TLD first (e.g., co.uk)
    if (secondLevelTld && TLD_COUNTRY_MAP[secondLevelTld]) {
      detectedCountry = TLD_COUNTRY_MAP[secondLevelTld].country
      detectedCountryCode = TLD_COUNTRY_MAP[secondLevelTld].code
    } else if (TLD_COUNTRY_MAP[tld]) {
      detectedCountry = TLD_COUNTRY_MAP[tld].country
      detectedCountryCode = TLD_COUNTRY_MAP[tld].code
    }
    
    // Comprehensive location detection from website content
    // Checks: country mentions, currency, phone numbers, addresses, business registrations
    const lowerContent = content.toLowerCase()
    const lowerHtml = html.toLowerCase()
    const combinedText = `${lowerContent} ${lowerHtml}`
    
    // Location detection scoring - accumulate evidence for each country
    const locationScores: Record<string, { score: number; country: string; code: string }> = {}
    
    const addScore = (code: string, country: string, points: number, reason: string) => {
      if (!locationScores[code]) {
        locationScores[code] = { score: 0, country, code }
      }
      locationScores[code].score += points
      console.log(`Location signal: ${country} +${points} (${reason})`)
    }
    
    // ========== SOUTH AFRICA ==========
    if (/\bsouth africa\b/i.test(combinedText)) addScore('ZA', 'South Africa', 10, 'country name')
    if (/\bsouth african\b/i.test(combinedText)) addScore('ZA', 'South Africa', 10, 'country adjective')
    if (/\bZAR\b/.test(combinedText)) addScore('ZA', 'South Africa', 8, 'ZAR currency')
    if (/R\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b/.test(combinedText)) addScore('ZA', 'South Africa', 5, 'Rand amounts')
    if (/\+27\s?\d/.test(combinedText)) addScore('ZA', 'South Africa', 8, 'SA phone number')
    if (/\b(?:johannesburg|joburg|cape town|durban|pretoria|sandton|centurion)\b/i.test(combinedText)) addScore('ZA', 'South Africa', 6, 'SA city')
    if (/\b(?:absa|fnb|nedbank|standard bank|capitec|discovery|vodacom|mtn sa|takealot|checkers|woolworths sa)\b/i.test(combinedText)) addScore('ZA', 'South Africa', 5, 'SA brand')
    if (/\b(?:pty|ltd|proprietary limited)\b/i.test(combinedText)) addScore('ZA', 'South Africa', 3, 'SA business type')
    
    // ========== GERMANY ==========
    if (/\bgermany\b/i.test(combinedText)) addScore('DE', 'Germany', 10, 'country name')
    if (/\bdeutschland\b/i.test(combinedText)) addScore('DE', 'Germany', 10, 'country name DE')
    if (/\b€\s?\d|EUR\b/.test(combinedText) && /\b(?:german|deutsch|berlin|münchen|hamburg)\b/i.test(combinedText)) addScore('DE', 'Germany', 6, 'Euro + German context')
    if (/\+49\s?\d/.test(combinedText)) addScore('DE', 'Germany', 8, 'DE phone number')
    if (/\b(?:berlin|münchen|munich|hamburg|frankfurt|köln|cologne|düsseldorf)\b/i.test(combinedText)) addScore('DE', 'Germany', 5, 'German city')
    if (/\b(?:gmbh|ag|e\.v\.|ohg|kg)\b/i.test(combinedText)) addScore('DE', 'Germany', 4, 'German business type')
    
    // ========== UNITED KINGDOM ==========
    if (/\bunited kingdom\b/i.test(combinedText)) addScore('UK', 'United Kingdom', 10, 'country name')
    if (/\b(?:£\s?\d|GBP)\b/.test(combinedText)) addScore('UK', 'United Kingdom', 7, 'GBP currency')
    if (/\+44\s?\d/.test(combinedText)) addScore('UK', 'United Kingdom', 8, 'UK phone number')
    if (/\b(?:london|manchester|birmingham|leeds|glasgow|edinburgh|bristol|liverpool)\b/i.test(combinedText)) addScore('UK', 'United Kingdom', 5, 'UK city')
    if (/\b(?:ltd|plc|llp)\b/i.test(combinedText) && /\b(?:uk|british|england|wales|scotland)\b/i.test(combinedText)) addScore('UK', 'United Kingdom', 4, 'UK business type')
    
    // ========== AUSTRALIA ==========
    if (/\baustralia\b/i.test(combinedText)) addScore('AU', 'Australia', 10, 'country name')
    if (/\b(?:A\$|AUD)\b/.test(combinedText)) addScore('AU', 'Australia', 7, 'AUD currency')
    if (/\+61\s?\d/.test(combinedText)) addScore('AU', 'Australia', 8, 'AU phone number')
    if (/\b(?:sydney|melbourne|brisbane|perth|adelaide|canberra)\b/i.test(combinedText)) addScore('AU', 'Australia', 5, 'AU city')
    if (/\b(?:abn|acn|pty ltd)\b/i.test(combinedText)) addScore('AU', 'Australia', 4, 'AU business registration')
    
    // ========== INDIA ==========
    if (/\bindia\b/i.test(combinedText)) addScore('IN', 'India', 10, 'country name')
    if (/\b(?:₹|INR|Rs\.?\s?\d)\b/.test(combinedText)) addScore('IN', 'India', 7, 'INR currency')
    if (/\+91\s?\d/.test(combinedText)) addScore('IN', 'India', 8, 'IN phone number')
    if (/\b(?:mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|kolkata|pune)\b/i.test(combinedText)) addScore('IN', 'India', 5, 'Indian city')
    
    // ========== NIGERIA ==========
    if (/\bnigeria\b/i.test(combinedText)) addScore('NG', 'Nigeria', 10, 'country name')
    if (/\b(?:₦|NGN)\b/.test(combinedText)) addScore('NG', 'Nigeria', 8, 'NGN currency')
    if (/\+234\s?\d/.test(combinedText)) addScore('NG', 'Nigeria', 8, 'NG phone number')
    if (/\b(?:lagos|abuja|port harcourt|ibadan|kano)\b/i.test(combinedText)) addScore('NG', 'Nigeria', 5, 'Nigerian city')
    
    // ========== CANADA ==========
    if (/\bcanada\b/i.test(combinedText)) addScore('CA', 'Canada', 10, 'country name')
    if (/\b(?:C\$|CAD)\b/.test(combinedText)) addScore('CA', 'Canada', 7, 'CAD currency')
    if (/\+1\s?(?:\()?(?:204|226|236|249|250|289|306|343|365|403|416|418|431|437|438|450|506|514|519|548|579|581|587|604|613|639|647|672|705|709|778|780|782|807|819|825|867|873|902|905)\b/.test(combinedText)) addScore('CA', 'Canada', 8, 'CA phone number')
    if (/\b(?:toronto|vancouver|montreal|calgary|ottawa|edmonton)\b/i.test(combinedText)) addScore('CA', 'Canada', 5, 'Canadian city')
    
    // ========== UAE ==========
    if (/\b(?:united arab emirates|uae)\b/i.test(combinedText)) addScore('AE', 'United Arab Emirates', 10, 'country name')
    if (/\b(?:AED|Dhs?\.?\s?\d)\b/.test(combinedText)) addScore('AE', 'United Arab Emirates', 7, 'AED currency')
    if (/\+971\s?\d/.test(combinedText)) addScore('AE', 'United Arab Emirates', 8, 'UAE phone number')
    if (/\b(?:dubai|abu dhabi|sharjah|ajman)\b/i.test(combinedText)) addScore('AE', 'United Arab Emirates', 6, 'UAE city')
    
    // ========== SINGAPORE ==========
    if (/\bsingapore\b/i.test(combinedText)) addScore('SG', 'Singapore', 10, 'country name')
    if (/\b(?:S\$|SGD)\b/.test(combinedText)) addScore('SG', 'Singapore', 7, 'SGD currency')
    if (/\+65\s?\d/.test(combinedText)) addScore('SG', 'Singapore', 8, 'SG phone number')
    
    // ========== KENYA ==========
    if (/\bkenya\b/i.test(combinedText)) addScore('KE', 'Kenya', 10, 'country name')
    if (/\b(?:KES|Ksh\.?\s?\d)\b/.test(combinedText)) addScore('KE', 'Kenya', 7, 'KES currency')
    if (/\+254\s?\d/.test(combinedText)) addScore('KE', 'Kenya', 8, 'KE phone number')
    if (/\b(?:nairobi|mombasa)\b/i.test(combinedText)) addScore('KE', 'Kenya', 5, 'Kenyan city')
    
    // ========== BRAZIL ==========
    if (/\bbrasil\b|\bbrazil\b/i.test(combinedText)) addScore('BR', 'Brazil', 10, 'country name')
    if (/\b(?:R\$|BRL)\b/.test(combinedText)) addScore('BR', 'Brazil', 7, 'BRL currency')
    if (/\+55\s?\d/.test(combinedText)) addScore('BR', 'Brazil', 8, 'BR phone number')
    if (/\b(?:são paulo|rio de janeiro|brasília|salvador|belo horizonte)\b/i.test(combinedText)) addScore('BR', 'Brazil', 5, 'Brazilian city')
    
    // ========== FRANCE ==========
    if (/\bfrance\b/i.test(combinedText)) addScore('FR', 'France', 10, 'country name')
    if (/\+33\s?\d/.test(combinedText)) addScore('FR', 'France', 8, 'FR phone number')
    if (/\b(?:paris|marseille|lyon|toulouse|nice|nantes|bordeaux)\b/i.test(combinedText)) addScore('FR', 'France', 5, 'French city')
    if (/\b(?:sarl|sas|sa|eurl)\b/i.test(combinedText) && /\b(?:france|french|paris)\b/i.test(combinedText)) addScore('FR', 'France', 4, 'French business type')
    
    // ========== OTHER EUROPEAN ==========
    if (/\bspain\b|\bespaña\b/i.test(combinedText)) addScore('ES', 'Spain', 10, 'country name')
    if (/\bitaly\b|\bitalia\b/i.test(combinedText)) addScore('IT', 'Italy', 10, 'country name')
    if (/\bnetherlands\b|\bnederland\b/i.test(combinedText)) addScore('NL', 'Netherlands', 10, 'country name')
    if (/\bswitzerland\b|\bschweiz\b|\bsuisse\b/i.test(combinedText)) addScore('CH', 'Switzerland', 10, 'country name')
    if (/\b(?:CHF|Fr\.?\s?\d)\b/.test(combinedText) && /\b(?:swiss|switzerland|zürich|geneva)\b/i.test(combinedText)) addScore('CH', 'Switzerland', 6, 'CHF currency')
    
    // Determine winner - need at least 5 points to be confident
    let bestMatch: { score: number; country: string; code: string } | null = null
    for (const loc of Object.values(locationScores)) {
      if (loc.score >= 5 && (!bestMatch || loc.score > bestMatch.score)) {
        bestMatch = loc
      }
    }
    
    if (bestMatch && !detectedCountry) {
      detectedCountry = bestMatch.country
      detectedCountryCode = bestMatch.code
      console.log(`Location detected from content: ${bestMatch.country} (score: ${bestMatch.score})`)
    }
    
    // Check for language meta tag as fallback (for non-English sites)
    if (!detectedCountry) {
      const langMatch = html.match(/<html[^>]*lang=["']([a-z]{2})(?:-([A-Z]{2}))?["']/i)
      if (langMatch) {
        const langCode = langMatch[1].toLowerCase()
        const regionCode = langMatch[2]?.toUpperCase()
        
        // If region code specified (like en-ZA, en-AU), use that
        const regionToCountry: Record<string, { country: string; code: string }> = {
          'ZA': { country: 'South Africa', code: 'ZA' },
          'AU': { country: 'Australia', code: 'AU' },
          'GB': { country: 'United Kingdom', code: 'UK' },
          'UK': { country: 'United Kingdom', code: 'UK' },
          'CA': { country: 'Canada', code: 'CA' },
          'IN': { country: 'India', code: 'IN' },
          'NG': { country: 'Nigeria', code: 'NG' },
          'KE': { country: 'Kenya', code: 'KE' },
          'DE': { country: 'Germany', code: 'DE' },
          'FR': { country: 'France', code: 'FR' },
          'ES': { country: 'Spain', code: 'ES' },
          'IT': { country: 'Italy', code: 'IT' },
          'BR': { country: 'Brazil', code: 'BR' },
          'AE': { country: 'United Arab Emirates', code: 'AE' },
        }
        
        if (regionCode && regionToCountry[regionCode]) {
          detectedCountry = regionToCountry[regionCode].country
          detectedCountryCode = regionToCountry[regionCode].code
          console.log(`Location from lang tag region: ${detectedCountry}`)
        } else {
          // Fall back to language-based detection for non-English languages
          const langToCountry: Record<string, { country: string; code: string }> = {
            'de': { country: 'Germany', code: 'DE' },
            'fr': { country: 'France', code: 'FR' },
            'es': { country: 'Spain', code: 'ES' },
            'it': { country: 'Italy', code: 'IT' },
            'nl': { country: 'Netherlands', code: 'NL' },
            'pt': { country: 'Brazil', code: 'BR' }, // Default Portuguese to Brazil
            'ja': { country: 'Japan', code: 'JP' },
            'ko': { country: 'South Korea', code: 'KR' },
            'zh': { country: 'China', code: 'CN' },
            'ar': { country: 'United Arab Emirates', code: 'AE' },
            'hi': { country: 'India', code: 'IN' },
          }
          if (langToCountry[langCode]) {
            detectedCountry = langToCountry[langCode].country
            detectedCountryCode = langToCountry[langCode].code
            console.log(`Location from lang tag: ${detectedCountry}`)
          }
        }
      }
    }
    
    // Check if the service is location-bound based on category keywords
    for (const category of LOCATION_BOUND_CATEGORIES) {
      if (lowerContent.includes(category)) {
        isLocationBound = true
        break
      }
    }
    
    // If we detected a non-English speaking country from TLD, likely location-bound
    if (detectedCountryCode && !['US', 'UK', 'AU', 'CA', 'NZ', 'IE'].includes(detectedCountryCode)) {
      // Non-English TLD suggests local market focus
      isLocationBound = true
    }
    
  } catch (error) {
    console.error("Location detection error:", error)
  }
  
  return {
    country: detectedCountry,
    countryCode: detectedCountryCode,
    isLocationBound,
  }
}

/**
 * Discover internal links that might be valuable pages (about, features, pricing, etc.)
 */
function discoverInternalLinks(html: string, baseUrl: string): string[] {
  const parsedBase = new URL(baseUrl)
  const domain = parsedBase.hostname
  const foundUrls = new Set<string>()
  
  // Priority pages to look for
  const priorityPaths = [
    /\/(about|company|who-we-are)/i,
    /\/(features|product|solutions|capabilities)/i,
    /\/(pricing|plans|packages)/i,
    /\/(faq|help|support)/i,
    /\/(compare|vs|comparison|alternatives)/i,
    /\/(customers|case-studies|testimonials|success-stories)/i,
    /\/(integrations|apps|partners)/i,
    /\/(blog|resources|learn)/i,
  ]
  
  // Extract all href attributes
  const hrefMatches = html.matchAll(/href=["']([^"']+)["']/gi)
  
  for (const match of hrefMatches) {
    let href = match[1]
    
    // Skip non-page links
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || 
        href.startsWith("javascript:") || href.includes(".pdf") || href.includes(".zip")) {
      continue
    }
    
    try {
      // Resolve relative URLs
      const resolvedUrl = new URL(href, baseUrl)
      
      // Only include same-domain links
      if (resolvedUrl.hostname !== domain) continue
      
      // Remove hash and query params for deduplication
      resolvedUrl.hash = ""
      const cleanUrl = resolvedUrl.toString()
      
      // Check if this is a priority page
      for (const pattern of priorityPaths) {
        if (pattern.test(resolvedUrl.pathname)) {
          foundUrls.add(cleanUrl)
          break
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  return Array.from(foundUrls)
}

/**
 * Fetch and analyze a single page
 */
async function fetchAndAnalyzePage(url: string): Promise<PageAnalysis | null> {
  try {
    const result = await fetchWebsiteContent(url)
    if (!result) return null
    
    const pageType = detectPageType(url, result.content)
    
    return {
      url,
      pageType,
      title: result.title || "",
      metaDescription: result.metaDescription,
      headings: result.headings.slice(0, 10),
      keyContent: result.paragraphs.slice(0, 5),
      hasSchema: result.hasSchema,
      schemaTypes: result.schemaTypes,
    }
  } catch (error) {
    console.error(`Failed to analyze page ${url}:`, error)
    return null
  }
}

/**
 * Detect the type of page based on URL and content
 */
function detectPageType(url: string, content: string): PageAnalysis["pageType"] {
  const lowerUrl = url.toLowerCase()
  const lowerContent = content.toLowerCase()
  
  if (/\/(about|company|who-we-are|our-story)/.test(lowerUrl)) return "about"
  if (/\/(features|product|solutions|capabilities)/.test(lowerUrl)) return "features"
  if (/\/(pricing|plans|packages)/.test(lowerUrl)) return "pricing"
  if (/\/(compare|vs|comparison|alternatives)/.test(lowerUrl)) return "comparison"
  if (/\/(faq|frequently-asked)/.test(lowerUrl) || lowerContent.includes("frequently asked")) return "faq"
  if (/\/(blog|articles|resources|learn)/.test(lowerUrl)) return "blog"
  
  return "other"
}

/**
 * Analyze content strategy across all crawled pages
 */
function analyzeContentStrategy(
  homepage: FetchResult,
  additionalPages: PageAnalysis[]
): ContentStrategyAnalysis {
  const allContent = [homepage.content, ...additionalPages.map(p => p.keyContent.join(" "))].join(" ").toLowerCase()
  const allHeadings = [...homepage.headings, ...additionalPages.flatMap(p => p.headings)].map(h => h.toLowerCase())
  
  // Check for comparison pages
  const hasComparisonPages = additionalPages.some(p => p.pageType === "comparison") ||
    allHeadings.some(h => h.includes(" vs ") || h.includes("alternative") || h.includes("compare"))
  
  // Check for FAQ
  const hasFAQSection = additionalPages.some(p => p.pageType === "faq") ||
    allContent.includes("frequently asked") || allHeadings.some(h => h.includes("faq"))
  const hasFAQSchema = homepage.schemaTypes.includes("FAQPage") ||
    additionalPages.some(p => p.schemaTypes?.includes("FAQPage"))
  
  // Check for product schema
  const hasProductSchema = homepage.schemaTypes.includes("Product") ||
    homepage.schemaTypes.includes("SoftwareApplication") ||
    additionalPages.some(p => p.schemaTypes?.includes("Product"))
  
  // Check for case studies/testimonials
  const hasCaseStudies = allContent.includes("case study") || allContent.includes("case studies") ||
    allContent.includes("success stor") || additionalPages.some(p => 
      p.url.includes("case-stud") || p.url.includes("success"))
  
  const hasTestimonials = allContent.includes("testimonial") || allContent.includes("what our customers say") ||
    allContent.includes("customer reviews") || allHeadings.some(h => 
      h.includes("testimonial") || h.includes("what our") || h.includes("customer say"))
  
  // Check for pricing
  const hasPricingPage = additionalPages.some(p => p.pageType === "pricing") ||
    allHeadings.some(h => h.includes("pricing") || h.includes("plans"))
  
  // Check for integrations
  const hasIntegrations = allContent.includes("integration") || allContent.includes("connect with") ||
    allContent.includes("works with") || allHeadings.some(h => h.includes("integration"))
  
  // Check for blog
  const hasBlogContent = additionalPages.some(p => p.pageType === "blog")
  
  // Extract authority signals
  const authoritySignals = extractAuthoritySignals(allContent, homepage.html)
  
  // Analyze value proposition clarity
  const valuePropositionClarity = analyzeValueProposition(homepage.content, homepage.headings)
  
  // Extract unique differentiators
  const uniqueDifferentiators = extractDifferentiators(allContent, allHeadings)
  
  // Determine category positioning
  const categoryPositioning = extractCategoryPositioning(homepage.content)
  
  // Identify missing content
  const missingContent: string[] = []
  if (!hasComparisonPages) missingContent.push("Comparison pages (e.g., 'Your Brand vs Competitor')")
  if (!hasFAQSection) missingContent.push("FAQ section")
  if (!hasFAQSchema) missingContent.push("FAQ schema markup")
  if (!hasProductSchema) missingContent.push("Product/SoftwareApplication schema")
  if (!hasCaseStudies) missingContent.push("Case studies or success stories")
  if (!hasTestimonials) missingContent.push("Customer testimonials section")
  if (!hasPricingPage) missingContent.push("Transparent pricing page")
  if (!hasIntegrations) missingContent.push("Integrations page")
  if (authoritySignals.reviewPlatformLinks.length === 0) missingContent.push("Links to review platforms (G2, Capterra, etc.)")
  if (authoritySignals.socialProofStats.length === 0) missingContent.push("Social proof statistics (customer counts, etc.)")
  
  return {
    pagesAnalyzed: [
      {
        url: homepage.url || "",
        pageType: "homepage",
        title: homepage.title || "",
        metaDescription: homepage.metaDescription,
        headings: homepage.headings.slice(0, 10),
        keyContent: homepage.paragraphs.slice(0, 5),
        hasSchema: homepage.hasSchema,
        schemaTypes: homepage.schemaTypes,
      },
      ...additionalPages,
    ],
    hasComparisonPages,
    hasFAQSection,
    hasFAQSchema,
    hasProductSchema,
    hasCaseStudies,
    hasTestimonials,
    hasPricingPage,
    hasIntegrations,
    hasBlogContent,
    valuePropositionClarity,
    uniqueDifferentiators,
    categoryPositioning,
    authoritySignals,
    missingContent,
    recommendations: [], // Filled in later
  }
}

/**
 * Extract authority signals from content
 */
function extractAuthoritySignals(content: string, html: string): ContentStrategyAnalysis["authoritySignals"] {
  const lowerContent = content.toLowerCase()
  const lowerHtml = html.toLowerCase()
  
  // Review platform links
  const reviewPlatforms = ["g2.com", "capterra.com", "trustpilot.com", "gartner.com", "trustradius.com", "getapp.com"]
  const reviewPlatformLinks = reviewPlatforms.filter(platform => 
    lowerHtml.includes(platform) || lowerHtml.includes(`href="https://${platform}`) ||
    lowerHtml.includes(`href="https://www.${platform}`)
  )
  
  // Press mentions
  const pressPatterns = ["featured in", "as seen in", "featured on", "mentioned in", "covered by"]
  const pressmentions = pressPatterns.filter(pattern => lowerContent.includes(pattern))
  
  // Awards
  const awardPatterns = ["award", "winner", "best of", "top rated", "leader in", "recognized by"]
  const awards = awardPatterns.filter(pattern => lowerContent.includes(pattern))
  
  // Partner/customer logos (check for common patterns)
  const logoPatterns = ["trusted by", "used by", "loved by", "our customers", "our partners", "companies using"]
  const partnerLogos = logoPatterns.filter(pattern => lowerContent.includes(pattern))
  
  // Social proof stats
  const statsPatterns: string[] = []
  const statMatches = content.match(/(\d{1,3}(?:,\d{3})*\+?\s*(?:customers|users|companies|teams|businesses|downloads|reviews))/gi)
  if (statMatches) {
    statsPatterns.push(...statMatches.slice(0, 5))
  }
  
  return {
    reviewPlatformLinks,
    pressmentions,
    awards,
    partnerLogos,
    customerLogos: [], // Would need image analysis
    socialProofStats: statsPatterns,
  }
}

/**
 * Analyze how clear the value proposition is
 */
function analyzeValueProposition(content: string, headings: string[]): "clear" | "somewhat_clear" | "unclear" {
  const mainHeading = headings[0]?.toLowerCase() || ""
  const firstParagraphs = content.slice(0, 500).toLowerCase()
  
  // Check for clear value proposition indicators
  const clearIndicators = [
    /help[s]?\s+\w+\s+(to\s+)?\w+/i, // "helps teams to collaborate"
    /make[s]?\s+\w+\s+\w+/i, // "makes work easier"
    /the\s+(best|#1|leading|top)\s+\w+\s+(for|to)/i, // "the best tool for"
    /\w+\s+that\s+\w+/i, // "software that automates"
  ]
  
  const hasActionableHeading = clearIndicators.some(pattern => pattern.test(mainHeading))
  const hasActionableContent = clearIndicators.some(pattern => pattern.test(firstParagraphs))
  
  // Check for specific benefits mentioned
  const benefitKeywords = ["save time", "increase", "reduce", "improve", "automate", "simplify", "faster", "easier"]
  const mentionsBenefits = benefitKeywords.some(kw => firstParagraphs.includes(kw))
  
  if (hasActionableHeading && mentionsBenefits) return "clear"
  if (hasActionableHeading || hasActionableContent || mentionsBenefits) return "somewhat_clear"
  return "unclear"
}

/**
 * Extract unique differentiators from content
 */
function extractDifferentiators(content: string, headings: string[]): string[] {
  const differentiators: string[] = []
  const lowerContent = content.toLowerCase()
  
  // Look for differentiator patterns
  const patterns = [
    /only\s+\w+\s+that/gi,
    /unlike\s+(?:other|competitors)/gi,
    /what\s+makes\s+us\s+different/gi,
    /unique(?:ly)?\s+\w+/gi,
    /first\s+\w+\s+to/gi,
  ]
  
  for (const pattern of patterns) {
    const matches = content.match(pattern)
    if (matches) {
      differentiators.push(...matches.slice(0, 2))
    }
  }
  
  // Check headings for differentiators
  for (const heading of headings) {
    if (heading.toLowerCase().includes("why") || heading.toLowerCase().includes("different") ||
        heading.toLowerCase().includes("unique") || heading.toLowerCase().includes("better")) {
      differentiators.push(heading)
    }
  }
  
  return [...new Set(differentiators)].slice(0, 5)
}

/**
 * Extract how the brand positions itself in its category
 */
function extractCategoryPositioning(content: string): string | null {
  const patterns = [
    /(?:we are|we're)\s+(?:a|an|the)\s+([^.]+(?:platform|tool|software|solution|app|service))/i,
    /(?:the|a|an)\s+(leading|top|best|#1|premier)\s+([^.]+(?:platform|tool|software|solution))/i,
    /([^.]+(?:platform|tool|software|solution|app))\s+(?:for|that|designed)/i,
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return match[0].slice(0, 100).trim()
    }
  }
  
  return null
}

/**
 * Generate AI visibility recommendations based on content strategy analysis
 */
function generateAIVisibilityRecommendations(
  strategy: ContentStrategyAnalysis,
  analysis: URLAnalysisResult
): ContentRecommendation[] {
  const recommendations: ContentRecommendation[] = []
  const brandName = analysis.extractedDescription?.split(" ")[0] || "Your brand"
  const competitors = analysis.discoveredCompetitors.slice(0, 3)
  
  // HIGH PRIORITY: Comparison pages
  if (!strategy.hasComparisonPages && competitors.length > 0) {
    recommendations.push({
      id: "comparison-pages",
      priority: "high",
      category: "content",
      title: "Create comparison pages",
      description: `AI models frequently respond to "X vs Y" queries. Without comparison pages, you're missing these opportunities.`,
      impact: "Comparison pages are one of the most effective ways to appear in AI recommendations when users ask about alternatives.",
      action: `Create pages comparing ${brandName} to each major competitor.`,
      example: `"${brandName} vs ${competitors[0]}" - explain key differences, pricing, and who each is best for.`,
    })
  }
  
  // HIGH PRIORITY: FAQ with schema
  if (!strategy.hasFAQSchema) {
    recommendations.push({
      id: "faq-schema",
      priority: "high",
      category: "technical",
      title: "Add FAQ schema markup",
      description: "FAQ schema helps AI understand your product through question-answer pairs.",
      impact: "AI models are trained on structured data. FAQ schema makes your content more likely to be cited when answering user questions.",
      action: "Add FAQPage schema to your FAQ section with common questions about your product.",
      example: `Include questions like "What is ${brandName}?", "How much does ${brandName} cost?", "What makes ${brandName} different?"`,
    })
  }
  
  // HIGH PRIORITY: Product schema
  if (!strategy.hasProductSchema) {
    recommendations.push({
      id: "product-schema",
      priority: "high",
      category: "technical",
      title: "Add Product/SoftwareApplication schema",
      description: "Structured product data helps AI understand what you offer.",
      impact: "Product schema provides AI with standardized information about your offering, pricing, and features.",
      action: "Implement Product or SoftwareApplication schema on your homepage with aggregateRating if you have reviews.",
    })
  }
  
  // MEDIUM: Case studies
  if (!strategy.hasCaseStudies) {
    recommendations.push({
      id: "case-studies",
      priority: "medium",
      category: "content",
      title: "Publish case studies",
      description: "Case studies demonstrate real-world value and build authority.",
      impact: "AI models favor brands with documented success stories. Case studies provide specific examples AI can reference.",
      action: "Create 3-5 detailed case studies showing measurable results for different customer types.",
      example: "Include specific metrics: 'Company X increased productivity by 40% using [brand]'",
    })
  }
  
  // MEDIUM: Review platform presence
  if (strategy.authoritySignals.reviewPlatformLinks.length === 0) {
    recommendations.push({
      id: "review-platforms",
      priority: "medium",
      category: "authority",
      title: "Link to review platforms",
      description: "AI often references review platforms when recommending products.",
      impact: "G2, Capterra, and Trustpilot ratings heavily influence AI recommendations. Having visible ratings builds credibility.",
      action: "Add badges/links to your review profiles on G2, Capterra, or Trustpilot. Display your rating prominently.",
    })
  }
  
  // MEDIUM: Social proof
  if (strategy.authoritySignals.socialProofStats.length === 0) {
    recommendations.push({
      id: "social-proof",
      priority: "medium",
      category: "authority",
      title: "Add social proof statistics",
      description: "Quantified social proof helps AI assess your market presence.",
      impact: "AI models use customer counts and usage statistics to gauge product popularity and trustworthiness.",
      action: "Prominently display metrics like '10,000+ customers' or 'Trusted by 500+ companies'.",
    })
  }
  
  // MEDIUM: Value proposition clarity
  if (strategy.valuePropositionClarity === "unclear") {
    recommendations.push({
      id: "value-proposition",
      priority: "medium",
      category: "positioning",
      title: "Clarify your value proposition",
      description: "AI needs to quickly understand what you do and who you serve.",
      impact: "A clear value proposition helps AI accurately describe and recommend your product.",
      action: "Update your homepage headline to clearly state: what you do, who it's for, and the main benefit.",
      example: "[Product] helps [audience] [achieve outcome] by [how]",
    })
  }
  
  // MEDIUM: Unique differentiators
  if (strategy.uniqueDifferentiators.length < 2) {
    recommendations.push({
      id: "differentiators",
      priority: "medium",
      category: "positioning",
      title: "Highlight unique differentiators",
      description: "AI needs clear reasons to recommend you over competitors.",
      impact: "Without clear differentiators, AI may default to recommending more established competitors.",
      action: "Create a 'Why [Brand]' or 'What makes us different' section with specific, verifiable claims.",
    })
  }
  
  // LOW: Testimonials
  if (!strategy.hasTestimonials) {
    recommendations.push({
      id: "testimonials",
      priority: "low",
      category: "content",
      title: "Add customer testimonials",
      description: "Testimonials provide third-party validation.",
      impact: "Customer quotes give AI specific language to use when describing your product's benefits.",
      action: "Add a testimonials section with quotes from recognizable companies or people in your industry.",
    })
  }
  
  // LOW: Integration pages
  if (!strategy.hasIntegrations) {
    recommendations.push({
      id: "integrations",
      priority: "low",
      category: "content",
      title: "Create an integrations page",
      description: "Integration partnerships signal ecosystem fit.",
      impact: "AI often recommends tools based on what they integrate with. Missing integration info = missed recommendations.",
      action: "List all integrations with popular tools in your category. Include logos and brief descriptions.",
    })
  }
  
  return recommendations
}

interface FetchResult {
  url?: string
  html: string
  content: string
  title: string
  metaDescription: string | null
  headings: string[]
  paragraphs: string[]
  hasSchema: boolean
  schemaTypes: string[]
}

/**
 * Fetch website content using fetch API
 * Returns structured result with raw HTML and extracted content
 */
async function fetchWebsiteContent(url: string): Promise<FetchResult | null> {
  try {
    // Normalize URL
    let normalizedUrl = url
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl
    }

    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MentionedBot/1.0; +https://mentioned.pro)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000), // 8 second timeout per page
    })

    if (!response.ok) {
      console.error("Failed to fetch URL:", response.status, response.statusText)
      return null
    }

    const html = await response.text()
    
    // Extract structured content from HTML
    const extracted = extractStructuredContent(html)
    
    return {
      url: normalizedUrl,
      html,
      content: extracted.content.slice(0, 8000),
      title: extracted.title,
      metaDescription: extracted.metaDescription,
      headings: extracted.headings,
      paragraphs: extracted.paragraphs,
      hasSchema: extracted.hasSchema,
      schemaTypes: extracted.schemaTypes,
    }
  } catch (error) {
    console.error("Error fetching website:", error)
    return null
  }
}

/**
 * Extract structured content from HTML including schema detection
 */
function extractStructuredContent(html: string): {
  content: string
  title: string
  metaDescription: string | null
  headings: string[]
  paragraphs: string[]
  hasSchema: boolean
  schemaTypes: string[]
} {
  // Remove script tags and their content (but save JSON-LD first)
  const schemaTypes: string[] = []
  let hasSchema = false
  
  // Extract JSON-LD schema types
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of jsonLdMatches) {
    hasSchema = true
    try {
      const json = JSON.parse(match[1])
      if (json["@type"]) {
        schemaTypes.push(json["@type"])
      }
      if (Array.isArray(json["@graph"])) {
        for (const item of json["@graph"]) {
          if (item["@type"]) schemaTypes.push(item["@type"])
        }
      }
    } catch {
      // Invalid JSON-LD
    }
  }
  
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
  text = text.replace(/<!--[\s\S]*?-->/g, " ")
  
  // Extract title
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim().replace(/<[^>]*>/g, "") : ""
  
  // Extract meta description
  const metaDescMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                        text.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null
  
  // Extract og:description
  const ogDescMatch = text.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
  const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : ""
  
  // Extract headings (h1, h2, h3)
  const headings: string[] = []
  const headingMatches = text.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)
  for (const match of headingMatches) {
    const heading = match[1].replace(/<[^>]*>/g, "").trim()
    if (heading && heading.length > 2 && heading.length < 200) {
      headings.push(heading)
    }
  }
  
  // Extract paragraphs
  const paragraphs: string[] = []
  const pMatches = text.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)
  for (const match of pMatches) {
    const p = match[1].replace(/<[^>]*>/g, "").trim()
    if (p && p.length > 20 && p.length < 500) {
      paragraphs.push(p)
    }
  }
  
  // Extract list items
  const listItems: string[] = []
  const liMatches = text.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)
  for (const match of liMatches) {
    const li = match[1].replace(/<[^>]*>/g, "").trim()
    if (li && li.length > 5 && li.length < 200) {
      listItems.push(li)
    }
  }
  
  // Compile content
  const parts = [
    `TITLE: ${title}`,
    metaDescription ? `META DESCRIPTION: ${metaDescription}` : "",
    ogDescription ? `OG DESCRIPTION: ${ogDescription}` : "",
    headings.length > 0 ? `\nHEADINGS:\n${headings.slice(0, 15).join("\n")}` : "",
    paragraphs.length > 0 ? `\nCONTENT:\n${paragraphs.slice(0, 20).join("\n\n")}` : "",
    listItems.length > 0 ? `\nFEATURES/LISTS:\n${listItems.slice(0, 20).join("\n")}` : "",
  ].filter(Boolean)
  
  return {
    content: parts.join("\n"),
    title,
    metaDescription,
    headings,
    paragraphs,
    hasSchema,
    schemaTypes: [...new Set(schemaTypes)],
  }
}


/**
 * Use AI to analyze the extracted website content
 */
async function analyzeContentWithAI(
  content: string, 
  url: string,
  detectedCountry: string | null = null,
  isLocationBound: boolean = false
): Promise<URLAnalysisResult | null> {
  const client = getOpenAIClient()
  
  if (!client) {
    // Return basic analysis without AI
    return basicContentAnalysis(content)
  }

  try {
    const prompt = `You are an expert business analyst. Analyze this website to understand exactly what type of business it is.

Website URL: ${url}

Website Content:
"""
${content}
"""

Analyze this content and extract information ONLY based on what is explicitly stated or clearly implied. Do NOT make up features.

Respond with this JSON only (no markdown):

{
  "extractedKeywords": ["5-10 keywords that describe what this product/service does"],
  "extractedFeatures": ["3-8 specific features mentioned on the website"],
  "extractedCategory": "the main product/service category - be VERY specific! Examples: 'health insurance', 'car rental', 'emergency medical services', 'payment gateway', 'yoga apparel', 'project management software'. NEVER use generic terms like 'software' or 'services' alone.",
  "extractedDescription": "A 1-2 sentence summary of what this product/service does",
  "targetAudience": "who the product is for (e.g., 'small businesses', 'South African merchants', 'Canadian families', or null if unclear)",
  "useCases": ["2-5 specific use cases mentioned or implied"],
  "pricingModel": "free, freemium, paid, enterprise, or null if not mentioned",
  "discoveredCompetitors": ["5-15 REAL competing brands in the same space"],
  
  "industryType": "Choose the BEST match from this list: healthcare, insurance, banking, fintech, car_rental, automotive, real_estate, legal, restaurant, hotel, fitness, education, travel, delivery, telecom, ecommerce, saas, marketing_agency, consulting, construction, manufacturing, retail, media, entertainment, nonprofit, government, other. Be precise!",
  
  "productType": "Choose ONE: 'physical' (tangible goods like clothing, cars, food), 'software' (digital products, apps, SaaS), or 'service' (professional services, rentals, healthcare, insurance, banking)",
  
  "industryTerminology": {
    "singular": "what ONE of these is called in this industry (e.g., 'provider' for healthcare, 'platform' for SaaS, 'brand' for clothing, 'agency' for marketing, 'carrier' for insurance, 'lender' for banking)",
    "plural": "the plural form (e.g., 'providers', 'platforms', 'brands', 'agencies')",
    "verbPhrase": "what you do with this (e.g., 'use' for software, 'buy from' for retail, 'sign up with' for services, 'hire' for agencies)"
  },
  
  "isLocationBound": true or false - "Is this business primarily serving a specific geographic region? TRUE for: local services, regional insurance, country-specific banking, local healthcare. FALSE for: global SaaS, international e-commerce, worldwide clothing brands",
  
  "confidence": 0.0-1.0
}

CRITICAL RULES:
1. industryType MUST be from the provided list - pick the closest match
2. productType MUST be exactly "physical", "software", or "service"
3. For insurance/banking/healthcare/legal - these are ALWAYS "service" not "software"
4. For clothing/gear/equipment/vehicles - these are ALWAYS "physical"
5. Only use "software" for actual digital products (apps, SaaS platforms, tools)
6. industryTerminology should match how people in this industry actually talk
${detectedCountry && isLocationBound ? `
7. LOCATION-SPECIFIC: This business operates in ${detectedCountry}. 
   For discoveredCompetitors, PUT LOCAL ${detectedCountry} COMPETITORS FIRST, then international players.` : ''}`

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    })

    const responseContent = completion.choices[0]?.message?.content || "{}"
    
    // Parse JSON response
    const parsed = parseJSONResponse<Partial<URLAnalysisResult>>(responseContent)
    
    if (parsed) {
      // Validate and normalize productType
      let normalizedProductType: "physical" | "software" | "service" | null = null
      if (parsed.productType === "physical" || parsed.productType === "software" || parsed.productType === "service") {
        normalizedProductType = parsed.productType
      }
      
      // Validate industryTerminology
      let terminology: URLAnalysisResult["industryTerminology"] = null
      if (parsed.industryTerminology && 
          typeof parsed.industryTerminology === "object" &&
          parsed.industryTerminology.singular && 
          parsed.industryTerminology.plural) {
        terminology = {
          singular: String(parsed.industryTerminology.singular),
          plural: String(parsed.industryTerminology.plural),
          verbPhrase: String(parsed.industryTerminology.verbPhrase || "use")
        }
      }
      
      // Handle AI-detected isLocationBound (AI might return boolean or string)
      const aiDetectedLocationBound = parsed.isLocationBound === true || String(parsed.isLocationBound).toLowerCase() === "true"
      
      console.log(`[AI Analysis] Industry: ${parsed.industryType}, ProductType: ${normalizedProductType}, LocationBound: ${aiDetectedLocationBound}`)
      console.log(`[AI Analysis] Terminology: ${terminology?.singular}/${terminology?.plural}, Verb: ${terminology?.verbPhrase}`)
      
      return {
        extractedKeywords: Array.isArray(parsed.extractedKeywords) ? parsed.extractedKeywords : [],
        extractedFeatures: Array.isArray(parsed.extractedFeatures) ? parsed.extractedFeatures : [],
        extractedCategory: parsed.extractedCategory || null,
        extractedDescription: parsed.extractedDescription || null,
        targetAudience: parsed.targetAudience || null,
        useCases: Array.isArray(parsed.useCases) ? parsed.useCases : [],
        pricingModel: parsed.pricingModel || null,
        discoveredCompetitors: Array.isArray(parsed.discoveredCompetitors) ? parsed.discoveredCompetitors : [],
        detectedCountry: null, // Will be filled in by caller
        detectedCountryCode: null, // Will be filled in by caller
        isLocationBound: aiDetectedLocationBound, // AI-detected, may be overridden by caller
        industryType: typeof parsed.industryType === "string" ? parsed.industryType.toLowerCase() : null,
        productType: normalizedProductType,
        industryTerminology: terminology,
        contentStrategy: null, // Will be filled in by caller
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
        scrapedContent: content,
      }
    }

    return basicContentAnalysis(content)
  } catch (error) {
    console.error("AI content analysis failed:", error)
    return basicContentAnalysis(content)
  }
}

/**
 * Basic content analysis without AI
 */
function basicContentAnalysis(content: string): URLAnalysisResult {
  const lowerContent = content.toLowerCase()
  
  // Extract keywords from content
  const words = lowerContent
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 4)
  
  // Count word frequency
  const wordCount = new Map<string, number>()
  const stopWords = new Set(["about", "their", "there", "would", "could", "should", "which", "these", "those", "being", "where", "after", "before", "while", "other", "every", "under", "above", "between", "through"])
  
  for (const word of words) {
    if (!stopWords.has(word)) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1)
    }
  }
  
  // Get top keywords
  const keywords = Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)

  return {
    extractedKeywords: keywords,
    extractedFeatures: [],
    extractedCategory: null,
    extractedDescription: null,
    targetAudience: null,
    useCases: [],
    pricingModel: null,
    discoveredCompetitors: [],
    detectedCountry: null,
    detectedCountryCode: null,
    isLocationBound: false,
    industryType: null,
    productType: null,
    industryTerminology: null,
    contentStrategy: null,
    confidence: 0.3,
    scrapedContent: content,
  }
}

/**
 * Parse JSON from response, handling common AI formatting issues
 */
function parseJSONResponse<T>(response: string): T | null {
  // Try direct parse first
  try {
    return JSON.parse(response) as T
  } catch {
    // Try to extract JSON from markdown code blocks or surrounding text
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T
      } catch {
        // JSON extraction failed
      }
    }
  }
  return null
}


