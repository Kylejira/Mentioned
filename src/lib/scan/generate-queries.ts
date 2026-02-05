import type { QueryDimension } from "./types"

// Query with dimension tag
export interface TaggedQuery {
  query: string
  dimension: QueryDimension
  variationGroup?: string // Groups related query variations together (e.g., "best_tools_v1", "best_tools_v2")
}

// Query variation set - same concept, different phrasing
interface QueryVariationSet {
  groupId: string
  dimension: QueryDimension
  variations: string[]
}

// Product type classification
type ProductType = "physical" | "software" | "service"

// Physical product categories
const PHYSICAL_PRODUCT_KEYWORDS = [
  // Clothing & Fashion
  "clothing", "clothes", "apparel", "fashion", "wear", "activewear", "sportswear", 
  "athleisure", "leggings", "pants", "shirts", "tops", "dresses", "jackets", "coats",
  "shoes", "sneakers", "footwear", "boots", "sandals", "heels",
  "accessories", "bags", "handbags", "jewelry", "watches", "sunglasses",
  "underwear", "lingerie", "swimwear", "bikini",
  // Sports & Fitness Equipment
  "yoga", "fitness", "gym", "workout", "exercise", "sports",
  "equipment", "gear", "mat", "weights", "dumbbells",
  // Food & Beverage
  "food", "beverage", "drink", "snack", "coffee", "tea", "wine", "beer",
  "restaurant", "cafe", "bakery", "grocery",
  // Vehicles
  "car", "vehicle", "automobile", "motorcycle", "bike", "bicycle", "scooter",
  "truck", "suv", "sedan", "electric vehicle", "ev",
  // Home & Furniture
  "furniture", "home", "decor", "mattress", "bed", "sofa", "chair", "table",
  "kitchen", "appliance", "cookware",
  // Beauty & Personal Care
  "beauty", "skincare", "makeup", "cosmetics", "haircare", "fragrance", "perfume",
  // Electronics (physical)
  "phone", "laptop", "headphones", "earbuds", "speaker", "camera", "tv", "monitor",
  // Outdoor & Recreation
  "outdoor", "camping", "hiking", "tent", "backpack",
  // Pet Products
  "pet", "dog", "cat", "pet food",
  // Baby & Kids
  "baby", "kids", "children", "toys", "stroller",
]

// Service keywords
const SERVICE_KEYWORDS = [
  // Professional services
  "consulting", "agency", "services", "coaching", "training",
  "cleaning", "repair", "maintenance", "delivery", "shipping",
  "legal", "accounting", "marketing agency", "design agency",
  "law firm", "lawyer", "attorney", "staffing", "recruitment",
  "photography", "videography", "translation", "printing",
  // Healthcare & Insurance
  "healthcare", "medical", "dental", "therapy", "salon", "spa",
  "hospital", "clinic", "pharmacy", "optometry", "chiropractic",
  "veterinary", "senior care", "nursing home", "telemedicine",
  "insurance", "insurer", "health insurance", "krankenversicherung", "krankenkasse",
  "versicherung", "coverage", "health plan", "health provider",
  "life insurance", "car insurance", "home insurance", "pet insurance",
  // Financial services
  "bank", "banking", "financial services", "mortgage", "loan", "credit",
  "finanzdienstleistung", "finanzinstitut", "investment banking", "private banking",
  "wealth management", "financial planning", "tax services", "accountant",
  // Real estate services
  "real estate", "property management", "realtor", "real estate agent",
  "vacation rental", "airbnb", "property rental",
  // Telecom & Utilities
  "telecom", "telecommunications", "utility", "provider",
  "mobile carrier", "internet provider", "isp", "cable tv",
  // Education services
  "tutoring", "driving school", "language school", "music lessons",
  "childcare", "daycare", "preschool",
  // Home services
  "plumbing", "electrical", "hvac", "roofing", "landscaping",
  "pest control", "moving services", "storage", "security services",
  // Travel & Hospitality
  "hotel", "resort", "airline", "travel agency", "tour operator",
  "cruise", "car rental", "catering", "event planning",
  // Fitness & Wellness services
  "gym", "fitness center", "yoga studio", "personal trainer",
  "spa", "massage", "wellness center",
  // Automotive services (not dealerships selling new cars)
  "car buying", "sell your car", "sell my car", "we buy cars", "webuycars",
  "car marketplace", "car market", "auto trader", "used car", "2nd hand car",
  "pre-owned", "car buyer", "cash for cars", "instant car sale",
]

// Software-specific keywords - only return "software" if these are present
const SOFTWARE_KEYWORDS = [
  "saas", "software", "app", "application", "platform", "tool",
  "api", "sdk", "plugin", "extension", "integration",
  "dashboard", "analytics tool", "automation tool",
  "crm", "erp", "cms", "project management", "task management",
  "ai tool", "machine learning", "developer tool", "devops",
  "no-code", "low-code", "cloud software",
]

/**
 * Detect if the product is physical, software, or a service
 */
function detectProductType(category: string, description: string): ProductType {
  const combined = `${category} ${description}`.toLowerCase()
  
  // Check for physical product indicators first
  for (const keyword of PHYSICAL_PRODUCT_KEYWORDS) {
    if (combined.includes(keyword)) {
      return "physical"
    }
  }
  
  // Check for software-specific indicators
  for (const keyword of SOFTWARE_KEYWORDS) {
    if (combined.includes(keyword)) {
      return "software"
    }
  }
  
  // Check for service indicators
  for (const keyword of SERVICE_KEYWORDS) {
    if (combined.includes(keyword)) {
      return "service"
    }
  }
  
  // Default to service - it's the most generic and works for most businesses
  // (insurance, banking, healthcare, consulting, etc.)
  return "service"
}

/**
 * Industry-specific terminology mappings
 * Each industry has specific terms people use when searching
 */
const INDUSTRY_TERMINOLOGY: Record<string, {
  singular: string
  plural: string
  productWord: string
  optionsWord: string
  toolWord: string
  platformWord: string
  buyVerb: string
  useVerb: string
}> = {
  // Healthcare / Medical
  healthcare: { singular: "provider", plural: "providers", productWord: "services", optionsWord: "options", toolWord: "", platformWord: "provider", buyVerb: "visit", useVerb: "see" },
  veterinary: { singular: "vet", plural: "vets", productWord: "services", optionsWord: "clinics", toolWord: "", platformWord: "clinic", buyVerb: "visit", useVerb: "take your pet to" },
  
  // Financial
  insurance: { singular: "carrier", plural: "carriers", productWord: "policies", optionsWord: "providers", toolWord: "", platformWord: "provider", buyVerb: "get coverage from", useVerb: "insure with" },
  banking: { singular: "bank", plural: "banks", productWord: "accounts", optionsWord: "options", toolWord: "", platformWord: "institution", buyVerb: "open an account with", useVerb: "bank with" },
  fintech: { singular: "provider", plural: "providers", productWord: "solutions", optionsWord: "platforms", toolWord: "", platformWord: "platform", buyVerb: "integrate with", useVerb: "use" },
  
  // Professional Services
  legal: { singular: "firm", plural: "firms", productWord: "services", optionsWord: "firms", toolWord: "", platformWord: "firm", buyVerb: "hire", useVerb: "work with" },
  consulting: { singular: "firm", plural: "firms", productWord: "services", optionsWord: "consultants", toolWord: "", platformWord: "firm", buyVerb: "hire", useVerb: "engage" },
  marketing_agency: { singular: "agency", plural: "agencies", productWord: "services", optionsWord: "agencies", toolWord: "", platformWord: "agency", buyVerb: "hire", useVerb: "work with" },
  recruitment: { singular: "agency", plural: "agencies", productWord: "services", optionsWord: "recruiters", toolWord: "", platformWord: "firm", buyVerb: "hire", useVerb: "work with" },
  
  // Automotive
  car_rental: { singular: "company", plural: "companies", productWord: "rentals", optionsWord: "options", toolWord: "", platformWord: "provider", buyVerb: "rent from", useVerb: "rent from" },
  automotive_sales: { singular: "dealer", plural: "dealers", productWord: "vehicles", optionsWord: "dealerships", toolWord: "", platformWord: "dealer", buyVerb: "buy from", useVerb: "buy from" },
  automotive_repair: { singular: "shop", plural: "shops", productWord: "services", optionsWord: "mechanics", toolWord: "", platformWord: "shop", buyVerb: "take your car to", useVerb: "get service from" },
  
  // Hospitality
  hotel: { singular: "hotel", plural: "hotels", productWord: "accommodations", optionsWord: "options", toolWord: "", platformWord: "property", buyVerb: "stay at", useVerb: "book" },
  restaurant: { singular: "restaurant", plural: "restaurants", productWord: "dining", optionsWord: "options", toolWord: "", platformWord: "establishment", buyVerb: "eat at", useVerb: "dine at" },
  
  // Real Estate
  real_estate: { singular: "agent", plural: "agents", productWord: "services", optionsWord: "realtors", toolWord: "", platformWord: "agency", buyVerb: "hire", useVerb: "work with" },
  
  // Education
  education: { singular: "school", plural: "schools", productWord: "programs", optionsWord: "institutions", toolWord: "", platformWord: "institution", buyVerb: "enroll in", useVerb: "attend" },
  
  // Home Services
  home_services: { singular: "contractor", plural: "contractors", productWord: "services", optionsWord: "pros", toolWord: "", platformWord: "service", buyVerb: "hire", useVerb: "call" },
  cleaning: { singular: "service", plural: "services", productWord: "cleaning", optionsWord: "cleaners", toolWord: "", platformWord: "service", buyVerb: "hire", useVerb: "use" },
  landscaping: { singular: "company", plural: "companies", productWord: "services", optionsWord: "landscapers", toolWord: "", platformWord: "service", buyVerb: "hire", useVerb: "use" },
  pest_control: { singular: "company", plural: "companies", productWord: "services", optionsWord: "exterminators", toolWord: "", platformWord: "service", buyVerb: "call", useVerb: "use" },
  moving: { singular: "company", plural: "companies", productWord: "services", optionsWord: "movers", toolWord: "", platformWord: "service", buyVerb: "hire", useVerb: "use" },
  security: { singular: "company", plural: "companies", productWord: "systems", optionsWord: "providers", toolWord: "", platformWord: "provider", buyVerb: "install", useVerb: "use" },
  
  // Creative Services
  photography: { singular: "photographer", plural: "photographers", productWord: "services", optionsWord: "photographers", toolWord: "", platformWord: "studio", buyVerb: "hire", useVerb: "book" },
  event_planning: { singular: "planner", plural: "planners", productWord: "services", optionsWord: "planners", toolWord: "", platformWord: "company", buyVerb: "hire", useVerb: "work with" },
  
  // Childcare
  childcare: { singular: "center", plural: "centers", productWord: "care", optionsWord: "daycares", toolWord: "", platformWord: "facility", buyVerb: "enroll in", useVerb: "send your child to" },
  
  // Beauty
  beauty: { singular: "salon", plural: "salons", productWord: "services", optionsWord: "spas", toolWord: "", platformWord: "salon", buyVerb: "visit", useVerb: "go to" },
  
  // Fitness
  fitness: { singular: "gym", plural: "gyms", productWord: "memberships", optionsWord: "fitness centers", toolWord: "", platformWord: "center", buyVerb: "join", useVerb: "work out at" },
  
  // Telecom
  telecom: { singular: "carrier", plural: "carriers", productWord: "plans", optionsWord: "providers", toolWord: "", platformWord: "carrier", buyVerb: "switch to", useVerb: "use" },
  
  // Travel
  travel: { singular: "agency", plural: "agencies", productWord: "packages", optionsWord: "options", toolWord: "", platformWord: "service", buyVerb: "book with", useVerb: "travel with" },
  
  // Delivery/Logistics
  delivery: { singular: "service", plural: "services", productWord: "shipping", optionsWord: "carriers", toolWord: "", platformWord: "service", buyVerb: "ship with", useVerb: "use" },
  logistics: { singular: "company", plural: "companies", productWord: "solutions", optionsWord: "providers", toolWord: "", platformWord: "provider", buyVerb: "partner with", useVerb: "use" },
  
  // Construction
  construction: { singular: "contractor", plural: "contractors", productWord: "services", optionsWord: "builders", toolWord: "", platformWord: "company", buyVerb: "hire", useVerb: "work with" },
  
  // Manufacturing
  manufacturing: { singular: "manufacturer", plural: "manufacturers", productWord: "products", optionsWord: "suppliers", toolWord: "", platformWord: "company", buyVerb: "order from", useVerb: "source from" },
  
  // Retail / Physical Products
  retail: { singular: "brand", plural: "brands", productWord: "products", optionsWord: "options", toolWord: "", platformWord: "retailer", buyVerb: "buy", useVerb: "shop at" },
  ecommerce: { singular: "store", plural: "stores", productWord: "products", optionsWord: "retailers", toolWord: "", platformWord: "marketplace", buyVerb: "buy from", useVerb: "shop at" },
  
  // Media / Entertainment
  media: { singular: "outlet", plural: "outlets", productWord: "content", optionsWord: "sources", toolWord: "", platformWord: "publication", buyVerb: "subscribe to", useVerb: "read" },
  entertainment: { singular: "service", plural: "services", productWord: "content", optionsWord: "platforms", toolWord: "", platformWord: "platform", buyVerb: "subscribe to", useVerb: "watch" },
  
  // Software
  saas: { singular: "platform", plural: "platforms", productWord: "software", optionsWord: "solutions", toolWord: "tool", platformWord: "platform", buyVerb: "subscribe to", useVerb: "use" },
  
  // Nonprofit / Government
  nonprofit: { singular: "organization", plural: "organizations", productWord: "programs", optionsWord: "charities", toolWord: "", platformWord: "organization", buyVerb: "donate to", useVerb: "support" },
  government: { singular: "agency", plural: "agencies", productWord: "services", optionsWord: "departments", toolWord: "", platformWord: "agency", buyVerb: "apply to", useVerb: "use" },
}

/**
 * Get appropriate terminology based on product type and optional industry
 */
function getProductTerminology(productType: ProductType, industryType?: string) {
  // Check for industry-specific terminology first
  if (industryType && INDUSTRY_TERMINOLOGY[industryType]) {
    return INDUSTRY_TERMINOLOGY[industryType]
  }
  
  // Fall back to generic product type terminology
  if (productType === "physical") {
    return {
      singular: "brand",
      plural: "brands",
      productWord: "products",
      optionsWord: "options",
      toolWord: "", // No "tool" for physical products
      platformWord: "", // No "platform" for physical products
      buyVerb: "buy",
      useVerb: "wear", // or "use" depending on context
    }
  } else if (productType === "service") {
    return {
      singular: "company",
      plural: "companies",
      productWord: "services",
      optionsWord: "options",
      toolWord: "",
      platformWord: "provider",
      buyVerb: "hire",
      useVerb: "use",
    }
  } else {
    return {
      singular: "tool",
      plural: "tools",
      productWord: "software",
      optionsWord: "options",
      toolWord: "tool",
      platformWord: "platform",
      buyVerb: "subscribe to",
      useVerb: "use",
    }
  }
}

/**
 * Industry-specific dimension mappings
 * Each industry has dimensions that are most relevant for rating companies in that space
 */
type IndustryType = 
  // Original industries
  | "car_rental" | "insurance" | "banking" | "healthcare" | "restaurant" 
  | "hotel" | "real_estate" | "legal" | "telecom" | "fitness"
  | "education" | "travel" | "automotive_sales" | "delivery" | "fintech"
  // New industries
  | "ecommerce" | "saas" | "marketing_agency" | "consulting" | "construction"
  | "manufacturing" | "retail" | "media" | "entertainment" | "nonprofit"
  | "government" | "automotive_repair" | "beauty" | "home_services" | "veterinary"
  | "childcare" | "event_planning" | "photography" | "recruitment" | "logistics"
  | "security" | "cleaning" | "landscaping" | "pest_control" | "moving"
  // Generic fallbacks
  | "generic_service" | "generic_physical" | "generic_software"

interface IndustryDimensions {
  dimensions: QueryDimension[]
  queries: { query: string; dimension: QueryDimension }[]
}

const INDUSTRY_DIMENSIONS: Record<IndustryType, IndustryDimensions> = {
  car_rental: {
    dimensions: ["fleet_quality", "customer_service", "value", "convenience", "reliability", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best vehicle selection and fleet quality?", dimension: "fleet_quality" },
      { query: "Which {category} {plural} have the best customer service and support?", dimension: "customer_service" },
      { query: "Which {category} {plural} offer the best value and transparent pricing?", dimension: "value" },
      { query: "Which {category} {plural} have the most convenient pickup and return locations?", dimension: "convenience" },
      { query: "Which {category} {plural} are most reliable with no hidden fees or surprises?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best reputation and customer reviews?", dimension: "reputation" },
    ]
  },
  insurance: {
    dimensions: ["coverage", "claims_process", "customer_service", "value", "reliability", "reputation"],
    queries: [
      { query: "Which {category} {plural} offer the best coverage options and policy flexibility?", dimension: "coverage" },
      { query: "Which {category} {plural} have the fastest and easiest claims process?", dimension: "claims_process" },
      { query: "Which {category} {plural} have the best customer service and support?", dimension: "customer_service" },
      { query: "Which {category} {plural} offer the best value for the premium cost?", dimension: "value" },
      { query: "Which {category} {plural} are most reliable and financially stable?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best reputation and customer satisfaction?", dimension: "reputation" },
    ]
  },
  banking: {
    dimensions: ["rates_fees", "digital_experience", "customer_service", "convenience", "reliability", "reputation"],
    queries: [
      { query: "Which {category} {plural} offer the best interest rates and lowest fees?", dimension: "rates_fees" },
      { query: "Which {category} {plural} have the best mobile app and online banking experience?", dimension: "digital_experience" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the most convenient branch and ATM locations?", dimension: "convenience" },
      { query: "Which {category} {plural} are most trustworthy and financially secure?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best overall reputation?", dimension: "reputation" },
    ]
  },
  healthcare: {
    dimensions: ["care_quality", "wait_times", "customer_service", "cleanliness", "network", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the highest quality of care and treatment?", dimension: "care_quality" },
      { query: "Which {category} {plural} have the shortest wait times for appointments?", dimension: "wait_times" },
      { query: "Which {category} {plural} have the best patient service and communication?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the best facilities and cleanliness standards?", dimension: "cleanliness" },
      { query: "Which {category} {plural} accept the most insurance plans and have the best network?", dimension: "network" },
      { query: "Which {category} {plural} have the best reputation and patient reviews?", dimension: "reputation" },
    ]
  },
  restaurant: {
    dimensions: ["food_quality", "customer_service", "ambiance", "value", "cleanliness", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best food quality and taste?", dimension: "food_quality" },
      { query: "Which {category} {plural} have the best service and staff?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the best atmosphere and ambiance?", dimension: "ambiance" },
      { query: "Which {category} {plural} offer the best value for money?", dimension: "value" },
      { query: "Which {category} {plural} have the best hygiene and cleanliness?", dimension: "cleanliness" },
      { query: "Which {category} {plural} are most highly rated and recommended?", dimension: "reputation" },
    ]
  },
  hotel: {
    dimensions: ["quality", "amenities", "location", "customer_service", "cleanliness", "value", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best room quality and comfort?", dimension: "quality" },
      { query: "Which {category} {plural} have the best amenities and facilities?", dimension: "amenities" },
      { query: "Which {category} {plural} have the best locations?", dimension: "location" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the highest cleanliness standards?", dimension: "cleanliness" },
      { query: "Which {category} {plural} offer the best value for money?", dimension: "value" },
    ]
  },
  real_estate: {
    dimensions: ["expertise", "communication", "reputation", "value", "reliability", "customer_service"],
    queries: [
      { query: "Which {category} {plural} have the best market expertise and knowledge?", dimension: "expertise" },
      { query: "Which {category} {plural} have the best communication and responsiveness?", dimension: "communication" },
      { query: "Which {category} {plural} have the best reputation and track record?", dimension: "reputation" },
      { query: "Which {category} {plural} offer the best value for their commission?", dimension: "value" },
      { query: "Which {category} {plural} are most trustworthy and reliable?", dimension: "reliability" },
      { query: "Which {category} {plural} provide the best overall client service?", dimension: "customer_service" },
    ]
  },
  legal: {
    dimensions: ["expertise", "communication", "reputation", "value", "reliability", "customer_service"],
    queries: [
      { query: "Which {category} {plural} have the best expertise and success rate?", dimension: "expertise" },
      { query: "Which {category} {plural} have the best client communication?", dimension: "communication" },
      { query: "Which {category} {plural} have the best reputation in the field?", dimension: "reputation" },
      { query: "Which {category} {plural} offer fair and transparent pricing?", dimension: "value" },
      { query: "Which {category} {plural} are most trustworthy and ethical?", dimension: "reliability" },
      { query: "Which {category} {plural} provide the best client service?", dimension: "customer_service" },
    ]
  },
  telecom: {
    dimensions: ["network", "value", "customer_service", "reliability", "digital_experience", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best network coverage and speed?", dimension: "network" },
      { query: "Which {category} {plural} offer the best value for their plans?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most reliable with minimal outages?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best app and online account management?", dimension: "digital_experience" },
      { query: "Which {category} {plural} have the best overall reputation?", dimension: "reputation" },
    ]
  },
  fitness: {
    dimensions: ["quality", "amenities", "convenience", "customer_service", "value", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best equipment and facilities?", dimension: "quality" },
      { query: "Which {category} {plural} have the best amenities and classes?", dimension: "amenities" },
      { query: "Which {category} {plural} have the most convenient locations and hours?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best staff and trainers?", dimension: "customer_service" },
      { query: "Which {category} {plural} offer the best membership value?", dimension: "value" },
      { query: "Which {category} {plural} have the best reputation and reviews?", dimension: "reputation" },
    ]
  },
  education: {
    dimensions: ["quality", "expertise", "value", "reputation", "convenience", "customer_service"],
    queries: [
      { query: "Which {category} {plural} provide the highest quality education?", dimension: "quality" },
      { query: "Which {category} {plural} have the best instructors and expertise?", dimension: "expertise" },
      { query: "Which {category} {plural} offer the best value for tuition?", dimension: "value" },
      { query: "Which {category} {plural} have the best reputation and outcomes?", dimension: "reputation" },
      { query: "Which {category} {plural} offer the most flexible scheduling?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best student support services?", dimension: "customer_service" },
    ]
  },
  travel: {
    dimensions: ["quality", "value", "customer_service", "safety", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the best travel experience?", dimension: "quality" },
      { query: "Which {category} {plural} offer the best value for money?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the best safety record?", dimension: "safety" },
      { query: "Which {category} {plural} are most convenient to book and use?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best reputation?", dimension: "reputation" },
    ]
  },
  automotive_sales: {
    dimensions: ["selection", "value", "customer_service", "reliability", "safety", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best selection of vehicles?", dimension: "selection" },
      { query: "Which {category} {plural} offer the best prices and deals?", dimension: "value" },
      { query: "Which {category} {plural} have the best sales experience and service?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most trustworthy and transparent?", dimension: "reliability" },
      { query: "Which {category} {plural} sell the safest vehicles?", dimension: "safety" },
      { query: "Which {category} {plural} have the best reputation?", dimension: "reputation" },
    ]
  },
  delivery: {
    dimensions: ["reliability", "convenience", "customer_service", "value", "quality", "reputation"],
    queries: [
      { query: "Which {category} {plural} are most reliable with on-time delivery?", dimension: "reliability" },
      { query: "Which {category} {plural} are most convenient to use?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best customer support?", dimension: "customer_service" },
      { query: "Which {category} {plural} offer the best value for shipping costs?", dimension: "value" },
      { query: "Which {category} {plural} handle packages with the most care?", dimension: "quality" },
      { query: "Which {category} {plural} have the best overall reputation?", dimension: "reputation" },
    ]
  },
  fintech: {
    dimensions: ["reliability", "rates_fees", "digital_experience", "customer_service", "value", "reputation"],
    queries: [
      { query: "Which {category} {plural} are most reliable and secure for processing payments?", dimension: "reliability" },
      { query: "Which {category} {plural} have the lowest transaction fees and best rates?", dimension: "rates_fees" },
      { query: "Which {category} {plural} have the best API and developer integration experience?", dimension: "digital_experience" },
      { query: "Which {category} {plural} have the best merchant support and customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} offer the best value for small to medium businesses?", dimension: "value" },
      { query: "Which {category} {plural} have the best reputation and are most trusted by merchants?", dimension: "reputation" },
    ]
  },
  generic_service: {
    dimensions: ["quality", "customer_service", "value", "reliability", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the best quality of service?", dimension: "quality" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} offer the best value for money?", dimension: "value" },
      { query: "Which {category} {plural} are most reliable and trustworthy?", dimension: "reliability" },
      { query: "Which {category} {plural} are most convenient to use?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best reputation?", dimension: "reputation" },
    ]
  },
  generic_physical: {
    dimensions: ["quality", "durability", "style", "comfort", "value", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best overall quality?", dimension: "quality" },
      { query: "Which {category} {plural} are the most durable and long-lasting?", dimension: "durability" },
      { query: "Which {category} {plural} have the best style and design?", dimension: "style" },
      { query: "Which {category} {plural} are the most comfortable?", dimension: "comfort" },
      { query: "Which {category} {plural} offer the best value for money?", dimension: "value" },
      { query: "Which {category} {plural} have the best reputation and reviews?", dimension: "reputation" },
    ]
  },
  generic_software: {
    dimensions: ["features", "ease_of_use", "performance", "value", "customer_service", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best features and capabilities?", dimension: "features" },
      { query: "Which {category} {plural} are easiest to use and learn?", dimension: "ease_of_use" },
      { query: "Which {category} {plural} have the best performance and reliability?", dimension: "performance" },
      { query: "Which {category} {plural} offer the best value for the price?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer support?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the best reputation?", dimension: "reputation" },
    ]
  },
  
  // ============== NEW INDUSTRIES ==============
  
  ecommerce: {
    dimensions: ["selection", "value", "customer_service", "reliability", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the widest product selection?", dimension: "selection" },
      { query: "Which {category} {plural} offer the best prices and deals?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer service and returns policy?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most reliable for shipping?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best website and shopping experience?", dimension: "convenience" },
      { query: "Which {category} {plural} are most trusted by shoppers?", dimension: "reputation" },
    ]
  },
  saas: {
    dimensions: ["features", "ease_of_use", "performance", "digital_experience", "value", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the most comprehensive features?", dimension: "features" },
      { query: "Which {category} {plural} are easiest to set up and use?", dimension: "ease_of_use" },
      { query: "Which {category} {plural} have the best uptime and performance?", dimension: "performance" },
      { query: "Which {category} {plural} have the best API and integrations?", dimension: "digital_experience" },
      { query: "Which {category} {plural} offer the best pricing for teams?", dimension: "value" },
      { query: "Which {category} {plural} are most recommended by professionals?", dimension: "reputation" },
    ]
  },
  marketing_agency: {
    dimensions: ["expertise", "communication", "value", "reliability", "quality", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best marketing expertise and results?", dimension: "expertise" },
      { query: "Which {category} {plural} have the best client communication?", dimension: "communication" },
      { query: "Which {category} {plural} offer the best value for their retainer fees?", dimension: "value" },
      { query: "Which {category} {plural} consistently deliver on their promises?", dimension: "reliability" },
      { query: "Which {category} {plural} produce the highest quality creative work?", dimension: "quality" },
      { query: "Which {category} {plural} have the best client testimonials?", dimension: "reputation" },
    ]
  },
  consulting: {
    dimensions: ["expertise", "communication", "value", "reliability", "quality", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the deepest industry expertise?", dimension: "expertise" },
      { query: "Which {category} {plural} communicate most effectively with clients?", dimension: "communication" },
      { query: "Which {category} {plural} provide the best ROI for their fees?", dimension: "value" },
      { query: "Which {category} {plural} are most reliable and meet deadlines?", dimension: "reliability" },
      { query: "Which {category} {plural} deliver the highest quality deliverables?", dimension: "quality" },
      { query: "Which {category} {plural} have the best track record and references?", dimension: "reputation" },
    ]
  },
  construction: {
    dimensions: ["quality", "reliability", "safety", "value", "communication", "reputation"],
    queries: [
      { query: "Which {category} {plural} deliver the highest quality workmanship?", dimension: "quality" },
      { query: "Which {category} {plural} complete projects on time and on budget?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best safety records?", dimension: "safety" },
      { query: "Which {category} {plural} offer competitive and fair pricing?", dimension: "value" },
      { query: "Which {category} {plural} communicate best throughout the project?", dimension: "communication" },
      { query: "Which {category} {plural} have the best reviews and references?", dimension: "reputation" },
    ]
  },
  manufacturing: {
    dimensions: ["quality", "reliability", "value", "customer_service", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} produce the highest quality products?", dimension: "quality" },
      { query: "Which {category} {plural} have the most reliable supply and delivery?", dimension: "reliability" },
      { query: "Which {category} {plural} offer the most competitive pricing?", dimension: "value" },
      { query: "Which {category} {plural} have the best account management?", dimension: "customer_service" },
      { query: "Which {category} {plural} are easiest to work with on custom orders?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best industry reputation?", dimension: "reputation" },
    ]
  },
  retail: {
    dimensions: ["selection", "quality", "style", "value", "customer_service", "reputation"],
    queries: [
      { query: "Which {category} {plural} have the best product selection?", dimension: "selection" },
      { query: "Which {category} {plural} offer the highest quality products?", dimension: "quality" },
      { query: "Which {category} {plural} have the best and most stylish designs?", dimension: "style" },
      { query: "Which {category} {plural} offer the best value for money?", dimension: "value" },
      { query: "Which {category} {plural} have the best in-store experience and service?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most popular with shoppers?", dimension: "reputation" },
    ]
  },
  media: {
    dimensions: ["quality", "reliability", "expertise", "value", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} produce the highest quality content?", dimension: "quality" },
      { query: "Which {category} {plural} are most reliable and consistent?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best journalists and expertise?", dimension: "expertise" },
      { query: "Which {category} {plural} offer the best subscription value?", dimension: "value" },
      { query: "Which {category} {plural} have the best apps and accessibility?", dimension: "convenience" },
      { query: "Which {category} {plural} are most trusted and credible?", dimension: "reputation" },
    ]
  },
  entertainment: {
    dimensions: ["quality", "selection", "value", "convenience", "digital_experience", "reputation"],
    queries: [
      { query: "Which {category} {plural} offer the best quality entertainment?", dimension: "quality" },
      { query: "Which {category} {plural} have the best content selection?", dimension: "selection" },
      { query: "Which {category} {plural} offer the best value for subscription?", dimension: "value" },
      { query: "Which {category} {plural} are most convenient to use?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best app and streaming experience?", dimension: "digital_experience" },
      { query: "Which {category} {plural} are most popular and highly rated?", dimension: "reputation" },
    ]
  },
  nonprofit: {
    dimensions: ["quality", "reliability", "value", "communication", "expertise", "reputation"],
    queries: [
      { query: "Which {category} {plural} make the biggest impact?", dimension: "quality" },
      { query: "Which {category} {plural} are most transparent about their work?", dimension: "reliability" },
      { query: "Which {category} {plural} use donations most efficiently?", dimension: "value" },
      { query: "Which {category} {plural} communicate best with supporters?", dimension: "communication" },
      { query: "Which {category} {plural} have the most expertise in their cause?", dimension: "expertise" },
      { query: "Which {category} {plural} are most trusted and reputable?", dimension: "reputation" },
    ]
  },
  government: {
    dimensions: ["quality", "reliability", "convenience", "communication", "digital_experience", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the best public services?", dimension: "quality" },
      { query: "Which {category} {plural} are most efficient and reliable?", dimension: "reliability" },
      { query: "Which {category} {plural} are most accessible to citizens?", dimension: "convenience" },
      { query: "Which {category} {plural} communicate best with the public?", dimension: "communication" },
      { query: "Which {category} {plural} have the best online services?", dimension: "digital_experience" },
      { query: "Which {category} {plural} are most trusted by citizens?", dimension: "reputation" },
    ]
  },
  automotive_repair: {
    dimensions: ["quality", "reliability", "value", "customer_service", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} do the highest quality repair work?", dimension: "quality" },
      { query: "Which {category} {plural} are most honest and trustworthy?", dimension: "reliability" },
      { query: "Which {category} {plural} offer the fairest pricing?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most convenient with scheduling?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best reviews and reputation?", dimension: "reputation" },
    ]
  },
  beauty: {
    dimensions: ["quality", "expertise", "ambiance", "value", "customer_service", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the highest quality treatments?", dimension: "quality" },
      { query: "Which {category} {plural} have the most skilled professionals?", dimension: "expertise" },
      { query: "Which {category} {plural} have the best ambiance and atmosphere?", dimension: "ambiance" },
      { query: "Which {category} {plural} offer the best value for treatments?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer experience?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most popular and highly rated?", dimension: "reputation" },
    ]
  },
  home_services: {
    dimensions: ["quality", "reliability", "value", "customer_service", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} do the best quality work?", dimension: "quality" },
      { query: "Which {category} {plural} show up on time and are most reliable?", dimension: "reliability" },
      { query: "Which {category} {plural} offer fair and competitive pricing?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} are easiest to book and schedule?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best reviews in my area?", dimension: "reputation" },
    ]
  },
  veterinary: {
    dimensions: ["care_quality", "expertise", "value", "customer_service", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the best care for pets?", dimension: "care_quality" },
      { query: "Which {category} {plural} have the most experienced vets?", dimension: "expertise" },
      { query: "Which {category} {plural} offer reasonable and transparent pricing?", dimension: "value" },
      { query: "Which {category} {plural} have the most compassionate staff?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the best hours and availability?", dimension: "convenience" },
      { query: "Which {category} {plural} are most recommended by pet owners?", dimension: "reputation" },
    ]
  },
  childcare: {
    dimensions: ["care_quality", "safety", "reliability", "value", "communication", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the best care and education?", dimension: "care_quality" },
      { query: "Which {category} {plural} have the best safety standards?", dimension: "safety" },
      { query: "Which {category} {plural} are most reliable and consistent?", dimension: "reliability" },
      { query: "Which {category} {plural} offer fair pricing for their services?", dimension: "value" },
      { query: "Which {category} {plural} communicate best with parents?", dimension: "communication" },
      { query: "Which {category} {plural} are most trusted by parents?", dimension: "reputation" },
    ]
  },
  event_planning: {
    dimensions: ["quality", "expertise", "value", "communication", "reliability", "reputation"],
    queries: [
      { query: "Which {category} {plural} create the most memorable events?", dimension: "quality" },
      { query: "Which {category} {plural} have the most creative expertise?", dimension: "expertise" },
      { query: "Which {category} {plural} work well within budgets?", dimension: "value" },
      { query: "Which {category} {plural} communicate best throughout the process?", dimension: "communication" },
      { query: "Which {category} {plural} are most reliable on event day?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best client testimonials?", dimension: "reputation" },
    ]
  },
  photography: {
    dimensions: ["quality", "style", "expertise", "value", "communication", "reputation"],
    queries: [
      { query: "Which {category} {plural} produce the highest quality images?", dimension: "quality" },
      { query: "Which {category} {plural} have the most appealing style?", dimension: "style" },
      { query: "Which {category} {plural} have the most experience and expertise?", dimension: "expertise" },
      { query: "Which {category} {plural} offer reasonable pricing packages?", dimension: "value" },
      { query: "Which {category} {plural} are easiest to work with?", dimension: "communication" },
      { query: "Which {category} {plural} are most recommended?", dimension: "reputation" },
    ]
  },
  recruitment: {
    dimensions: ["expertise", "reliability", "value", "communication", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} find the best quality candidates?", dimension: "expertise" },
      { query: "Which {category} {plural} fill positions fastest?", dimension: "reliability" },
      { query: "Which {category} {plural} offer the best value for their fees?", dimension: "value" },
      { query: "Which {category} {plural} communicate best throughout the process?", dimension: "communication" },
      { query: "Which {category} {plural} have the smoothest hiring process?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best reputation with employers?", dimension: "reputation" },
    ]
  },
  logistics: {
    dimensions: ["reliability", "value", "customer_service", "convenience", "quality", "reputation"],
    queries: [
      { query: "Which {category} {plural} are most reliable with delivery times?", dimension: "reliability" },
      { query: "Which {category} {plural} offer the most competitive rates?", dimension: "value" },
      { query: "Which {category} {plural} have the best account support?", dimension: "customer_service" },
      { query: "Which {category} {plural} are easiest to integrate with?", dimension: "convenience" },
      { query: "Which {category} {plural} handle shipments with the most care?", dimension: "quality" },
      { query: "Which {category} {plural} are most trusted by businesses?", dimension: "reputation" },
    ]
  },
  security: {
    dimensions: ["reliability", "quality", "expertise", "value", "customer_service", "reputation"],
    queries: [
      { query: "Which {category} {plural} provide the most reliable protection?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best equipment and monitoring?", dimension: "quality" },
      { query: "Which {category} {plural} have the most trained and professional staff?", dimension: "expertise" },
      { query: "Which {category} {plural} offer the best value for monthly service?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer support?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most trusted and recommended?", dimension: "reputation" },
    ]
  },
  cleaning: {
    dimensions: ["quality", "reliability", "value", "customer_service", "convenience", "reputation"],
    queries: [
      { query: "Which {category} {plural} do the most thorough cleaning?", dimension: "quality" },
      { query: "Which {category} {plural} show up on time consistently?", dimension: "reliability" },
      { query: "Which {category} {plural} offer the best value for money?", dimension: "value" },
      { query: "Which {category} {plural} have the friendliest staff?", dimension: "customer_service" },
      { query: "Which {category} {plural} are easiest to book and schedule?", dimension: "convenience" },
      { query: "Which {category} {plural} have the best reviews?", dimension: "reputation" },
    ]
  },
  landscaping: {
    dimensions: ["quality", "reliability", "expertise", "value", "communication", "reputation"],
    queries: [
      { query: "Which {category} {plural} do the best quality landscaping work?", dimension: "quality" },
      { query: "Which {category} {plural} are most reliable with maintenance schedules?", dimension: "reliability" },
      { query: "Which {category} {plural} have the best design expertise?", dimension: "expertise" },
      { query: "Which {category} {plural} offer competitive pricing?", dimension: "value" },
      { query: "Which {category} {plural} communicate well about project progress?", dimension: "communication" },
      { query: "Which {category} {plural} have the best portfolio and reviews?", dimension: "reputation" },
    ]
  },
  pest_control: {
    dimensions: ["quality", "reliability", "safety", "value", "customer_service", "reputation"],
    queries: [
      { query: "Which {category} {plural} are most effective at eliminating pests?", dimension: "quality" },
      { query: "Which {category} {plural} show up on time and are reliable?", dimension: "reliability" },
      { query: "Which {category} {plural} use the safest treatment methods?", dimension: "safety" },
      { query: "Which {category} {plural} offer fair and transparent pricing?", dimension: "value" },
      { query: "Which {category} {plural} have the best customer service?", dimension: "customer_service" },
      { query: "Which {category} {plural} are most recommended?", dimension: "reputation" },
    ]
  },
  moving: {
    dimensions: ["reliability", "quality", "value", "customer_service", "safety", "reputation"],
    queries: [
      { query: "Which {category} {plural} are most reliable with timing?", dimension: "reliability" },
      { query: "Which {category} {plural} handle belongings with the most care?", dimension: "quality" },
      { query: "Which {category} {plural} offer competitive and honest pricing?", dimension: "value" },
      { query: "Which {category} {plural} have the most professional crews?", dimension: "customer_service" },
      { query: "Which {category} {plural} have the best insurance coverage?", dimension: "safety" },
      { query: "Which {category} {plural} have the best reviews and reputation?", dimension: "reputation" },
    ]
  },
}

/**
 * Detect the specific industry based on category, description, and AI-detected industry type
 */
function detectIndustry(category: string, description: string, aiIndustryType: string | null = null): IndustryType {
  // If AI provided a valid industry type, use it
  if (aiIndustryType) {
    const validIndustries: IndustryType[] = [
      "car_rental", "insurance", "banking", "healthcare", "restaurant",
      "hotel", "real_estate", "legal", "telecom", "fitness",
      "education", "travel", "automotive_sales", "delivery", "fintech",
      "ecommerce", "saas", "marketing_agency", "consulting", "construction",
      "manufacturing", "retail", "media", "entertainment", "nonprofit",
      "government", "automotive_repair", "beauty", "home_services", "veterinary",
      "childcare", "event_planning", "photography", "recruitment", "logistics",
      "security", "cleaning", "landscaping", "pest_control", "moving"
    ]
    if (validIndustries.includes(aiIndustryType as IndustryType)) {
      console.log(`[Industry] Using AI-detected: ${aiIndustryType}`)
      return aiIndustryType as IndustryType
    }
  }
  
  const combined = `${category} ${description}`.toLowerCase()
  
  // ============ SPECIFIC INDUSTRIES (check first) ============
  
  // Car rental / vehicle rental
  if (combined.includes("car rental") || combined.includes("vehicle rental") || 
      combined.includes("rent a car") || combined.includes("rental car")) {
    return "car_rental"
  }
  
  // Fintech / Payment Gateway
  if (combined.includes("payment gateway") || combined.includes("payment processor") ||
      combined.includes("payment solution") || combined.includes("fintech") ||
      combined.includes("online payments") || combined.includes("card payments") ||
      combined.includes("merchant services") || combined.includes("payment provider") ||
      combined.includes("payment processing") || combined.includes("ecommerce payments") ||
      combined.includes("checkout") || combined.includes("payment platform")) {
    return "fintech"
  }
  
  // Insurance
  if (combined.includes("insurance") || combined.includes("insurer") || 
      combined.includes("coverage") || combined.includes("policy")) {
    return "insurance"
  }
  
  // Banking / Financial
  if (combined.includes("bank") || combined.includes("credit union") || 
      combined.includes("savings account") || combined.includes("checking account") ||
      combined.includes("mortgage") || combined.includes("personal loan")) {
    return "banking"
  }
  
  // Healthcare / Medical
  if (combined.includes("healthcare") || combined.includes("hospital") || 
      combined.includes("clinic") || combined.includes("medical") ||
      combined.includes("doctor") || combined.includes("dental") ||
      combined.includes("pharmacy") || combined.includes("health care") ||
      combined.includes("urgent care") || combined.includes("ambulance") ||
      combined.includes("emergency medical") || combined.includes("paramedic")) {
    return "healthcare"
  }
  
  // Veterinary
  if (combined.includes("veterinar") || combined.includes("vet clinic") ||
      combined.includes("animal hospital") || combined.includes("pet care")) {
    return "veterinary"
  }
  
  // Beauty / Salon / Spa
  if (combined.includes("salon") || combined.includes("spa") ||
      combined.includes("beauty") || combined.includes("hair stylist") ||
      combined.includes("nail") || combined.includes("massage") ||
      combined.includes("skincare") || combined.includes("cosmetic")) {
    return "beauty"
  }
  
  // Restaurant / Food service
  if (combined.includes("restaurant") || combined.includes("cafe") || 
      combined.includes("dining") || combined.includes("food service") ||
      combined.includes("eatery") || combined.includes("bistro") ||
      combined.includes("catering") || combined.includes("food truck")) {
    return "restaurant"
  }
  
  // Hotel / Accommodation
  if (combined.includes("hotel") || combined.includes("resort") || 
      combined.includes("accommodation") || combined.includes("lodging") ||
      combined.includes("motel") || combined.includes("inn") ||
      combined.includes("bed and breakfast") || combined.includes("airbnb") ||
      combined.includes("vacation rental")) {
    return "hotel"
  }
  
  // Real estate
  if (combined.includes("real estate") || combined.includes("realtor") || 
      combined.includes("property") || combined.includes("realty") ||
      combined.includes("estate agent") || combined.includes("broker")) {
    return "real_estate"
  }
  
  // Legal services
  if (combined.includes("law firm") || combined.includes("lawyer") || 
      combined.includes("attorney") || combined.includes("legal service") ||
      combined.includes("paralegal") || combined.includes("notary")) {
    return "legal"
  }
  
  // Telecom
  if (combined.includes("telecom") || combined.includes("mobile carrier") || 
      combined.includes("phone carrier") || combined.includes("internet provider") ||
      combined.includes("isp") || combined.includes("wireless carrier") ||
      combined.includes("broadband") || combined.includes("fiber internet")) {
    return "telecom"
  }
  
  // Fitness / Gym
  if (combined.includes("gym") || combined.includes("fitness center") || 
      combined.includes("health club") || combined.includes("workout") ||
      combined.includes("crossfit") || combined.includes("yoga studio") ||
      combined.includes("personal trainer") || combined.includes("pilates")) {
    return "fitness"
  }
  
  // Education
  if (combined.includes("school") || combined.includes("university") || 
      combined.includes("college") || combined.includes("education") ||
      combined.includes("tutoring") || combined.includes("online learning") ||
      combined.includes("training program") || combined.includes("online course") ||
      combined.includes("bootcamp") || combined.includes("academy")) {
    return "education"
  }
  
  // Travel / Airlines
  if (combined.includes("airline") || combined.includes("travel agency") || 
      combined.includes("flight booking") || combined.includes("cruise") ||
      combined.includes("tour operator") || combined.includes("vacation package")) {
    return "travel"
  }
  
  // Car sales / Dealership / Used cars
  if (combined.includes("car dealer") || combined.includes("dealership") || 
      combined.includes("used car") || combined.includes("auto sales") ||
      combined.includes("car buying") || combined.includes("sell car") ||
      combined.includes("we buy cars") || combined.includes("car market")) {
    return "automotive_sales"
  }
  
  // Automotive Repair
  if (combined.includes("auto repair") || combined.includes("car repair") ||
      combined.includes("mechanic") || combined.includes("auto shop") ||
      combined.includes("car service") || combined.includes("tire shop") ||
      combined.includes("oil change") || combined.includes("brake service")) {
    return "automotive_repair"
  }
  
  // Logistics
  if (combined.includes("logistics") || combined.includes("freight") ||
      combined.includes("supply chain") || combined.includes("3pl") ||
      combined.includes("warehousing") || combined.includes("fulfillment")) {
    return "logistics"
  }
  
  // Delivery / Shipping
  if (combined.includes("delivery") || combined.includes("shipping") || 
      combined.includes("courier") || combined.includes("parcel") ||
      combined.includes("last mile")) {
    return "delivery"
  }
  
  // E-commerce
  if (combined.includes("ecommerce") || combined.includes("e-commerce") ||
      combined.includes("online store") || combined.includes("online shop") ||
      combined.includes("marketplace") || combined.includes("online retail")) {
    return "ecommerce"
  }
  
  // SaaS
  if (combined.includes("saas") || combined.includes("software as a service") ||
      combined.includes("cloud software") || combined.includes("subscription software") ||
      combined.includes("platform") || combined.includes("crm") ||
      combined.includes("erp") || combined.includes("project management")) {
    return "saas"
  }
  
  // Marketing Agency
  if (combined.includes("marketing agency") || combined.includes("ad agency") ||
      combined.includes("digital marketing") || combined.includes("seo agency") ||
      combined.includes("social media agency") || combined.includes("creative agency") ||
      combined.includes("pr agency") || combined.includes("branding agency")) {
    return "marketing_agency"
  }
  
  // Consulting
  if (combined.includes("consulting") || combined.includes("consultant") ||
      combined.includes("advisory") || combined.includes("management consulting") ||
      combined.includes("strategy consulting") || combined.includes("business consulting")) {
    return "consulting"
  }
  
  // Construction
  if (combined.includes("construction") || combined.includes("contractor") ||
      combined.includes("builder") || combined.includes("general contractor") ||
      combined.includes("home building") || combined.includes("renovation")) {
    return "construction"
  }
  
  // Manufacturing
  if (combined.includes("manufacturing") || combined.includes("manufacturer") ||
      combined.includes("factory") || combined.includes("production") ||
      combined.includes("industrial") || combined.includes("fabrication")) {
    return "manufacturing"
  }
  
  // Retail (physical stores/clothing/apparel)
  if (combined.includes("retail") || combined.includes("clothing") ||
      combined.includes("apparel") || combined.includes("fashion") ||
      combined.includes("boutique") || combined.includes("activewear") ||
      combined.includes("sportswear") || combined.includes("footwear") ||
      combined.includes("shoe") || combined.includes("accessories")) {
    return "retail"
  }
  
  // Media
  if (combined.includes("media") || combined.includes("news") ||
      combined.includes("publishing") || combined.includes("magazine") ||
      combined.includes("journalism") || combined.includes("broadcasting")) {
    return "media"
  }
  
  // Entertainment
  if (combined.includes("entertainment") || combined.includes("streaming") ||
      combined.includes("gaming") || combined.includes("casino") ||
      combined.includes("theme park") || combined.includes("cinema") ||
      combined.includes("movie theater") || combined.includes("concert")) {
    return "entertainment"
  }
  
  // Nonprofit
  if (combined.includes("nonprofit") || combined.includes("non-profit") ||
      combined.includes("charity") || combined.includes("foundation") ||
      combined.includes("ngo") || combined.includes("donation")) {
    return "nonprofit"
  }
  
  // Government
  if (combined.includes("government") || combined.includes("municipal") ||
      combined.includes("city service") || combined.includes("public service") ||
      combined.includes("state agency") || combined.includes("federal")) {
    return "government"
  }
  
  // Home Services (plumbing, HVAC, electrical)
  if (combined.includes("plumber") || combined.includes("plumbing") ||
      combined.includes("hvac") || combined.includes("electrician") ||
      combined.includes("handyman") || combined.includes("home repair") ||
      combined.includes("home service") || combined.includes("appliance repair")) {
    return "home_services"
  }
  
  // Childcare
  if (combined.includes("childcare") || combined.includes("daycare") ||
      combined.includes("preschool") || combined.includes("nanny") ||
      combined.includes("babysit") || combined.includes("after school")) {
    return "childcare"
  }
  
  // Event Planning
  if (combined.includes("event planning") || combined.includes("wedding planner") ||
      combined.includes("event coordinator") || combined.includes("party planning") ||
      combined.includes("conference planning") || combined.includes("event management")) {
    return "event_planning"
  }
  
  // Photography
  if (combined.includes("photography") || combined.includes("photographer") ||
      combined.includes("photo studio") || combined.includes("videography") ||
      combined.includes("wedding photo") || combined.includes("portrait")) {
    return "photography"
  }
  
  // Recruitment / Staffing
  if (combined.includes("recruitment") || combined.includes("staffing") ||
      combined.includes("headhunter") || combined.includes("talent acquisition") ||
      combined.includes("job placement") || combined.includes("temp agency") ||
      combined.includes("hiring") || combined.includes("hr consulting")) {
    return "recruitment"
  }
  
  // Security
  if (combined.includes("security") || combined.includes("alarm") ||
      combined.includes("surveillance") || combined.includes("guard service") ||
      combined.includes("cctv") || combined.includes("monitoring")) {
    return "security"
  }
  
  // Cleaning
  if (combined.includes("cleaning") || combined.includes("janitorial") ||
      combined.includes("maid service") || combined.includes("house cleaning") ||
      combined.includes("commercial cleaning") || combined.includes("carpet cleaning")) {
    return "cleaning"
  }
  
  // Landscaping
  if (combined.includes("landscaping") || combined.includes("lawn care") ||
      combined.includes("garden") || combined.includes("tree service") ||
      combined.includes("lawn mowing") || combined.includes("irrigation")) {
    return "landscaping"
  }
  
  // Pest Control
  if (combined.includes("pest control") || combined.includes("exterminator") ||
      combined.includes("termite") || combined.includes("rodent") ||
      combined.includes("bug") || combined.includes("insect control")) {
    return "pest_control"
  }
  
  // Moving
  if (combined.includes("moving company") || combined.includes("movers") ||
      combined.includes("relocation") || combined.includes("moving service") ||
      combined.includes("packing service") || combined.includes("storage")) {
    return "moving"
  }
  
  // ============ FALLBACK TO GENERIC TYPES ============
  console.log(`[Industry] No specific match found for: "${category}" - using generic_service`)
  return "generic_service"
}

/**
 * Get industry-specific queries with proper dimensions
 */
function getIndustryQueries(
  industry: IndustryType,
  category: string,
  terms: ReturnType<typeof getProductTerminology>,
  brandName: string,
  brandWithContext: string,
  locationSuffix: string
): TaggedQuery[] {
  const industryConfig = INDUSTRY_DIMENSIONS[industry]
  
  return industryConfig.queries.map(q => ({
    query: q.query
      .replace(/{category}/g, category)
      .replace(/{plural}/g, terms.plural)
      .replace(/{brandName}/g, brandName)
      .replace(/{brandWithContext}/g, brandWithContext)
      + locationSuffix,
    dimension: q.dimension
  }))
}

/**
 * Generate highly specific, targeted queries for the exact product being scanned.
 * Every query MUST include the specific category and be actionable.
 * Priority order ensures the most valuable queries are always included.
 * Returns queries tagged with their dimension for categorized scoring.
 */
export function generateQueries(
  brandName: string,
  category: string,
  description: string,
  competitors: string[] = [],
  extractedKeywords: string[] = [],
  useCases: string[] = []
): string[] {
  // Generate tagged queries and extract just the query strings
  const taggedQueries = generateTaggedQueries(brandName, category, description, competitors, extractedKeywords, useCases)
  return taggedQueries.map(tq => tq.query)
}

/**
 * Common English words that might be brand names - these need context to be unambiguous
 * e.g., "Budget" could mean cheap options OR Budget car rental
 */
const AMBIGUOUS_BRAND_WORDS = new Set([
  // Common adjectives (often brand names)
  "budget", "smart", "fast", "easy", "simple", "quick", "express", "prime", "best", 
  "good", "great", "free", "safe", "sure", "clear", "first", "direct", "max", "pro",
  "plus", "one", "go", "now", "next", "new", "global", "national", "american",
  "general", "standard", "classic", "premium", "elite", "select", "choice", "value",
  "instant", "rapid", "swift", "speedy", "flash", "snap", "click", "dash", "zoom",
  "fresh", "clean", "pure", "bright", "true", "real", "honest", "loyal", "care",
  "active", "total", "complete", "absolute", "perfect", "ideal", "ultimate", "super",
  "mega", "extra", "ultra", "hyper", "turbo", "power", "force", "energy",
  
  // Common nouns (could be brands)
  "discovery", "momentum", "liberty", "unity", "harmony", "pioneer", "frontier",
  "gateway", "bridge", "summit", "apex", "peak", "crown", "diamond", "gold", "silver",
  "star", "sun", "moon", "sky", "ocean", "wave", "stream", "river", "mountain",
  "eagle", "falcon", "lion", "tiger", "bear", "wolf", "fox", "hawk", "phoenix",
  "anchor", "compass", "beacon", "shield", "guardian", "sentinel", "atlas", "titan",
  "spark", "ember", "flame", "blaze", "frost", "crystal", "amber", "jade", "ruby",
  "grove", "meadow", "forest", "valley", "canyon", "coast", "shore", "bay", "harbor",
  
  // Business/professional terms
  "capital", "trust", "group", "partners", "alliance", "solutions", "systems",
  "advantage", "edge", "source", "core", "base", "center", "central", "metro",
  "venture", "enterprise", "commerce", "trade", "market", "exchange",
  
  // Tech/digital words
  "hub", "link", "connect", "sync", "flow", "cloud", "data", "info", "byte",
  "net", "web", "tech", "digital", "online", "mobile", "cyber", "pixel", "code",
  "loop", "node", "grid", "matrix", "pulse", "signal", "wave", "beam",
  
  // Service-related
  "care", "help", "assist", "support", "service", "serve", "deliver", "drive",
  "guard", "protect", "secure", "cover", "shield", "assure", "insure",
  
  // Action words
  "pay", "save", "earn", "gain", "grow", "build", "create", "make", "craft",
  "boost", "lift", "rise", "leap", "jump", "sprint", "race", "chase", "reach",
  
  // Time/place
  "home", "local", "city", "metro", "urban", "rural", "west", "east", "north", "south",
  "today", "tomorrow", "future", "modern", "legacy", "heritage", "origin",
  
  // Numbers and letters (often ambiguous)
  "alpha", "beta", "delta", "omega", "zero", "infinite", "triple", "double",
])

/**
 * Check if a brand name is ambiguous and needs category context
 */
function brandNeedsContext(brandName: string): boolean {
  const lowerBrand = brandName.toLowerCase().trim()
  // Single word brands that are common words need context
  if (AMBIGUOUS_BRAND_WORDS.has(lowerBrand)) {
    return true
  }
  // Very short brand names (3 chars or less) usually need context
  if (lowerBrand.length <= 3) {
    return true
  }
  return false
}

/**
 * Get brand name with context if needed for clarity
 * e.g., "Budget" -> "Budget car rental" or "Budget (car rental)"
 */
function getBrandWithContext(brandName: string, category: string): string {
  if (brandNeedsContext(brandName)) {
    // Clean up category for natural language
    const cleanCategory = category
      .replace(/\s+services?$/i, '')
      .replace(/\s+companies?$/i, '')
      .replace(/\s+brands?$/i, '')
      .trim()
    return `${brandName} ${cleanCategory}`
  }
  return brandName
}

// AI-detected terminology from URL analysis
interface AITerminology {
  singular: string
  plural: string
  verbPhrase: string
}

/**
 * Generate queries with dimension tags for categorized scoring
 * @param queryCount - Target number of queries (12 for free, 25 for paid)
 * @param detectedCountry - Detected country for geo-specific queries
 * @param isLocationBound - Whether service requires location-specific queries
 * @param aiIndustryType - AI-detected industry type (e.g., "healthcare", "insurance", "fintech")
 * @param aiProductType - AI-detected product type ("physical", "software", "service")
 * @param aiTerminology - AI-detected industry terminology
 */
export function generateTaggedQueries(
  brandName: string,
  category: string,
  description: string,
  competitors: string[] = [],
  extractedKeywords: string[] = [],
  useCases: string[] = [],
  userCategories: string[] = [], // User-provided search categories
  queryCount: number = 12, // Number of queries to generate (12 free, 25 paid)
  detectedCountry: string | null = null, // Detected country for geo-specific queries
  isLocationBound: boolean = false, // Whether service is region-specific
  aiIndustryType: string | null = null, // AI-detected industry type
  aiProductType: "physical" | "software" | "service" | null = null, // AI-detected product type
  aiTerminology: AITerminology | null = null // AI-detected terminology
): TaggedQuery[] {
  // Use AI-detected product type if available, otherwise detect from keywords
  const productType = aiProductType || detectProductType(category, description)
  
  // Get terminology: AI-provided > industry-specific > generic product type
  const defaultTerms = getProductTerminology(productType, aiIndustryType || undefined)
  
  // Merge AI terminology with defaults (AI overrides singular/plural but we keep all other properties)
  const terms = aiTerminology 
    ? {
        ...defaultTerms,
        singular: aiTerminology.singular || defaultTerms.singular,
        plural: aiTerminology.plural || defaultTerms.plural,
        useVerb: aiTerminology.verbPhrase || defaultTerms.useVerb,
      }
    : defaultTerms
  
  // Log what we're using
  console.log(`[Query Gen] Using productType: ${productType} (AI: ${aiProductType || 'not provided'})`)
  console.log(`[Query Gen] Using terminology: ${terms.singular}/${terms.plural} (source: ${aiTerminology ? 'AI' : aiIndustryType ? 'industry' : 'generic'})`)
  console.log(`[Query Gen] AI industry type: ${aiIndustryType || 'not provided'}`)
  
  // Use user categories if provided, otherwise use the primary category
  const searchCategories = userCategories.length > 0 ? userCategories : [category]
  
  // Determine if this is an enhanced scan (paid plan)
  const isEnhancedScan = queryCount > 15
  
  // Extract contextual information from description
  const useCase = extractUseCase(description) || (useCases.length > 0 ? useCases[0] : null)
  const audience = extractAudience(description)
  const problem = extractProblem(description)
  const features = extractFeatures(description)
  const industry = extractIndustry(description)
  
  // Combine all features and keywords
  const allFeatures = [...new Set([...features, ...extractedKeywords])].filter(f => f.length > 2)
  const allUseCases = [...new Set([useCase, ...useCases].filter(Boolean))] as string[]
  
  // Use "currently" or "today" instead of specific year to avoid AI knowledge cutoff issues
  const currentYear = new Date().getFullYear()
  const timePhrase = "today" // Avoid specific year which can cause AI to refuse answering
  
  // Ensure category is appropriate - don't add "tools" or "software" for physical products
  let specificCategory = category
  if (!category || category.toLowerCase() === 'software' || category.toLowerCase() === 'business services') {
    if (productType === "physical") {
      specificCategory = industry ? `${industry} products` : "products"
    } else if (productType === "service") {
      specificCategory = industry ? `${industry} services` : "services"
  } else {
      specificCategory = industry ? `${industry} tools` : "business software"
    }
  }
  
  // Sanitize category for service companies - make queries more natural
  // Remove country names from category (they're handled by location suffix)
  // Fix awkward phrasing like "evac canada" -> "emergency medical services"
  const countriesInCategory = ['canada', 'usa', 'america', 'uk', 'australia', 'germany', 'france', 
    'south africa', 'india', 'brazil', 'mexico', 'japan', 'china', 'singapore', 'dubai', 'uae']
  let cleanedCategory = specificCategory.toLowerCase()
  for (const country of countriesInCategory) {
    cleanedCategory = cleanedCategory.replace(new RegExp(`\\b${country}\\b`, 'gi'), '').trim()
  }
  // Remove extra spaces
  cleanedCategory = cleanedCategory.replace(/\s+/g, ' ').trim()
  if (cleanedCategory && cleanedCategory !== specificCategory.toLowerCase()) {
    specificCategory = cleanedCategory
    console.log(`Category cleaned: removed country -> "${specificCategory}"`)
  }
  
  if (productType === "service") {
    const categorySanitizations: Record<string, string> = {
      // Car services
      "car buying service": "car buying",
      "car marketplace": "used car",
      "2nd hand car market": "used car buying",
      "2nd hand car": "used car buying",
      "second hand car": "used car buying",
      "used cars": "used car buying",
      "car market": "used car",
      "sell your car": "car buying",
      "sell my car": "car buying",
      "car retail": "used car",
      // Medical/Emergency services
      "evac": "emergency medical services",
      "evacuation": "emergency medical services",
      "ems": "emergency medical services",
      "ambulance": "ambulance services",
      "paramedic": "paramedic services",
      "emergency response": "emergency response services",
      "medical transport": "medical transport services",
      "air ambulance": "air ambulance services",
      // Other services
      "staffing": "staffing agencies",
      "recruitment": "recruitment agencies",
      "temp agency": "staffing agencies",
    }
    const lowerCategory = specificCategory.toLowerCase()
    for (const [pattern, replacement] of Object.entries(categorySanitizations)) {
      if (lowerCategory.includes(pattern) || lowerCategory === pattern) {
        specificCategory = replacement
        console.log(`Category sanitized: "${lowerCategory}" -> "${replacement}"`)
        break
      }
    }
  }
  
  // If category is too short or generic after cleaning, use a better default
  if (specificCategory.length < 3 || ['the', 'and', 'for', 'services', 'company'].includes(specificCategory.toLowerCase())) {
    if (industry) {
      specificCategory = productType === "service" ? `${industry} services` : `${industry} products`
      console.log(`Category defaulted to: "${specificCategory}"`)
    }
  }

  // ===========================================
  // LOCATION-SPECIFIC QUERY HANDLING
  // For location-bound services (insurance, banking, healthcare, etc.)
  // queries should include the country/region
  // ===========================================
  const locationPrefix = isLocationBound && detectedCountry ? `in ${detectedCountry}` : ""
  const locationSuffix = isLocationBound && detectedCountry ? ` in ${detectedCountry}` : ""
  const locationContext = isLocationBound && detectedCountry ? detectedCountry : null

  // ===========================================
  // BRAND NAME CONTEXT HANDLING
  // For ambiguous brand names (e.g., "Budget", "Discovery", "Smart")
  // we need to include category context to avoid confusion
  // e.g., "Is Budget worth it?" -> "Is Budget car rental worth it?"
  // ===========================================
  const brandWithContext = getBrandWithContext(brandName, specificCategory)

  // ===========================================
  // INDUSTRY DETECTION
  // Detect specific industry for tailored dimensions and queries
  // e.g., car rental, insurance, banking, healthcare, etc.
  // Uses AI-detected industry type if available, falls back to keyword detection
  // ===========================================
  const detectedIndustry: IndustryType = aiIndustryType 
    ? detectIndustry(specificCategory, description, aiIndustryType)
    : productType === "service" 
      ? detectIndustry(specificCategory, description)
      : productType === "physical" 
        ? "generic_physical"
        : "generic_software"
  
  console.log(`[Query Gen] Detected industry: ${detectedIndustry}`)

  // ===========================================
  // PRIORITY 1: MUST-INCLUDE QUERIES (Always selected)
  // These are the most valuable for determining visibility
  // Physical products use: quality, style, comfort, durability, price, reputation
  // Software uses: quality, features, performance, ease_of_use, price, reputation
  // ===========================================
  const priorityQueries: TaggedQuery[] = []
  
  // Query 1: Direct brand knowledge - tests if AI knows the brand (reputation)
  if (productType === "physical") {
    priorityQueries.push({
      query: `What is ${brandWithContext}? Tell me about this ${specificCategory} brand${locationSuffix} - what do they sell, who is their target customer, and what are they known for?`,
      dimension: "reputation"
    })
  } else {
    priorityQueries.push({
      query: `What is ${brandWithContext}? Tell me about this ${specificCategory}${locationSuffix} - what does it do, who uses it, and what are its main features?`,
      dimension: "general"
    })
  }
  
  // Query 2: Category recommendation - tests if brand appears in recommendations (quality)
  // Location is crucial here for location-bound services
  if (productType === "physical") {
    priorityQueries.push({
      query: locationContext 
        ? `What are the best ${specificCategory} ${terms.plural} in ${locationContext}? What are the top 5-7 ${terms.plural} I should consider?`
        : `What are the best ${specificCategory} ${terms.plural} available today? What are the top 5-7 ${terms.plural} I should consider, and what makes each one unique?`,
      dimension: "quality"
    })
  } else {
    priorityQueries.push({
      query: locationContext
        ? `I'm looking for the best ${specificCategory} ${terms.plural} in ${locationContext}. What are the top 5-7 options I should consider?`
        : `I'm looking for the best ${specificCategory} ${terms.plural}. What are the top 5-7 options I should consider, and what makes each one unique?`,
      dimension: "quality"
    })
  }
  
  // Query 3: Competitor comparison (if we have competitors)
  if (competitors.length > 0) {
    if (productType === "physical") {
      priorityQueries.push({
        query: `Compare ${brandName} vs ${competitors[0]}${locationSuffix}. Which ${specificCategory} brand is better and why? What are the key differences in quality, style, pricing, and who each is best for?`,
        dimension: "quality"
      })
    } else {
      priorityQueries.push({
        query: `Compare ${brandName} vs ${competitors[0]}${locationSuffix} for ${specificCategory}. Which is better and why? What are the key differences in features, pricing, and who each is best for?`,
        dimension: "general"
      })
    }
  } else {
    // If no competitors, ask for alternatives
    priorityQueries.push({
      query: locationContext
        ? `What are the best alternatives to ${brandName} in ${locationContext}? I'm evaluating ${specificCategory} ${terms.optionsWord} and want to compare the top choices.`
        : `What are the best alternatives to ${brandName}? I'm evaluating ${specificCategory} ${terms.optionsWord} and want to compare the top choices.`,
      dimension: "general"
    })
  }

  // ===========================================
  // PRIORITY 2: CONTEXTUAL QUERIES (Selected based on available data)
  // Physical products use: quality, style, comfort, durability, price, reputation
  // Software uses: quality, features, performance, ease_of_use, price, reputation
  // ===========================================
  const contextualQueries: TaggedQuery[] = []
  
  // Use case specific query
  if (useCase && useCase.length > 5) {
    if (productType === "physical") {
      contextualQueries.push({
        query: `I need ${specificCategory} specifically for ${useCase}. What are the best ${terms.plural} for this? Please recommend 3-5 options with pros and cons.`,
        dimension: "quality" // Physical: general quality for use case
      })
    } else {
      contextualQueries.push({
        query: `I need ${specificCategory} specifically for ${useCase}. What are the best ${terms.plural} for this exact use case? Please recommend 3-5 options with pros and cons.`,
        dimension: "performance"
      })
    }
  }
  
  // Audience-specific query
  if (audience) {
    if (productType === "physical") {
      contextualQueries.push({
        query: `What ${specificCategory} ${terms.plural} do you recommend for ${audience}? What are the top options that would suit them best?`,
        dimension: "style" // Physical: style/fit for audience
      })
    } else if (productType === "service") {
      contextualQueries.push({
        query: `What ${specificCategory} ${terms.plural} do you recommend for ${audience}? We need reliable service that suits our needs. What are the top options?`,
        dimension: "convenience" // Service: convenience/fit for audience
      })
  } else {
      contextualQueries.push({
        query: `What ${specificCategory} do you recommend for ${audience}? We need something that's well-suited to our size and needs. What are the top options?`,
        dimension: "ease_of_use"
      })
    }
  }
  
  // Industry-specific query (reputation)
  if (industry) {
    if (productType === "physical") {
      contextualQueries.push({
        query: `What ${specificCategory} ${terms.plural} are most popular for ${industry}? Which ones are typically chosen and why?`,
        dimension: "reputation"
      })
    } else {
      contextualQueries.push({
        query: `What ${specificCategory} ${terms.plural} are most popular in the ${industry} industry? Which ones do ${industry} companies typically choose and why?`,
        dimension: "reputation"
      })
    }
  }
  
  // Feature/quality-specific query
  if (allFeatures.length >= 2) {
    if (productType === "physical") {
      contextualQueries.push({
        query: `I need ${specificCategory} with excellent ${allFeatures[0]} and ${allFeatures[1]}. Which ${terms.plural} are known for these qualities?`,
        dimension: "quality" // Physical: quality attributes
      })
    } else {
      contextualQueries.push({
        query: `I need ${specificCategory} with strong ${allFeatures[0]} and ${allFeatures[1]} capabilities. Which ${terms.plural} excel at these specific features?`,
        dimension: "features"
      })
    }
  } else if (allFeatures.length === 1) {
    if (productType === "physical") {
      contextualQueries.push({
        query: `Which ${specificCategory} ${terms.plural} are best known for ${allFeatures[0]}? I want something that really excels in this area.`,
        dimension: "quality"
      })
    } else {
      contextualQueries.push({
        query: `Which ${specificCategory} ${terms.plural} are best known for ${allFeatures[0]}? I want something that really excels in this area.`,
        dimension: "features"
      })
    }
  }
  
  // Multi-competitor comparison (general)
  if (competitors.length >= 2) {
    const compList = competitors.slice(0, 3).join(', ')
    contextualQueries.push({
      query: `Help me choose between ${compList}, and ${brandName} for ${specificCategory}. What are the pros, cons, and ideal use cases for each?`,
      dimension: "general"
    })
  }
  
  // Problem-solving / need query
  if (problem) {
    if (productType === "physical") {
      contextualQueries.push({
        query: `I'm looking for ${specificCategory} that's great for ${problem}. Which ${terms.plural} are best for this?`,
        dimension: "comfort" // Physical: comfort/fit for needs
      })
    } else if (productType === "service") {
      contextualQueries.push({
        query: `I need ${specificCategory} ${terms.plural} that can help with ${problem}. Which ones are most reliable for this?`,
        dimension: "reliability" // Service: reliability for needs
      })
    } else {
      contextualQueries.push({
        query: `Our main challenge is ${problem}. Which ${specificCategory} ${terms.plural} are best designed to solve this specific problem?`,
        dimension: "performance"
      })
    }
  }

  // ===========================================
  // PRIORITY 3: BACKUP QUERIES (Only used if needed)
  // Ensure coverage across all dimensions
  // Queries are adapted based on product type
  // ===========================================
  const backupQueries: TaggedQuery[] = []
  
  if (productType === "physical") {
    // PHYSICAL PRODUCT QUERIES
    // Dimensions: quality, style, comfort, durability, price, reputation
    
    // Market leader query (reputation)
    backupQueries.push({
      query: `Who are the market leaders in ${specificCategory} right now? Which ${terms.plural} are considered the best and why?`,
      dimension: "reputation"
    })
    
    // Decision-making query (quality)
    backupQueries.push({
      query: `I'm trying to decide which ${specificCategory} brand to buy. What factors should I consider, and which ${terms.plural} are best for each factor?`,
      dimension: "quality"
    })
    
    // Alternative to competitor query (general)
  if (competitors.length > 0) {
      backupQueries.push({
        query: `I currently ${terms.useVerb} ${competitors[0]} but I'm looking for alternatives. What are the best ${specificCategory} ${terms.plural} similar to them${locationSuffix}, and how does ${brandName} compare?`,
        dimension: "general"
      })
    }
    
    // Emerging brands query (reputation)
    backupQueries.push({
      query: `Are there any newer or up-and-coming ${specificCategory} ${terms.plural} that are worth considering over the established names? What's trending right now?`,
      dimension: "reputation"
    })
    
    // Budget/value query (price)
    backupQueries.push({
      query: `What are the most affordable ${specificCategory} ${terms.plural} that still have good quality? I want good value for money.`,
      dimension: "price"
    })
    
    // Comfort/fit query (comfort)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are known for being the most comfortable? I want something that feels great to ${terms.useVerb}.`,
      dimension: "comfort"
    })
    
    // Quality/materials query (quality)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are known for the best quality materials and craftsmanship?`,
      dimension: "quality"
    })
    
    // Durability query (durability)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are the most durable and long-lasting? I want something that will hold up over time.`,
      dimension: "durability"
    })
    
    // Style/design query (style)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} have the best style and design? I want something that looks great.`,
      dimension: "style"
    })
    
    // Reviews/reputation query (reputation)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} have the best reviews and customer satisfaction? What do people actually say about them?`,
      dimension: "reputation"
    })
    
    // Premium/luxury query (quality)
    backupQueries.push({
      query: `What's the highest quality ${specificCategory} brand available? I want the premium option and price is not a concern.`,
      dimension: "quality"
    })
    
    // Aesthetic/trendy query (style)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are the most stylish and on-trend right now? I want something fashionable.`,
      dimension: "style"
    })
    
    // Budget-friendly query (price)
    backupQueries.push({
      query: `What are the cheapest ${specificCategory} options that are still good quality? I'm on a tight budget.`,
      dimension: "price"
    })
    
    // Fit/sizing query (comfort)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are known for having the best fit and sizing? I want something that fits well.`,
      dimension: "comfort"
    })
    
    // Sustainability query (quality - eco quality)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are the most sustainable and eco-friendly? I care about environmental impact.`,
      dimension: "quality"
    })
    
  } else if (productType === "service") {
    // INDUSTRY-SPECIFIC SERVICE QUERIES
    // Use dimensions tailored to the specific industry (car rental, insurance, banking, etc.)
    
    // Get industry-specific queries with proper dimensions
    const industryQueries = getIndustryQueries(
      detectedIndustry,
      specificCategory,
      terms,
      brandName,
      brandWithContext,
      locationSuffix
    )
    
    // Add all industry-specific queries
    backupQueries.push(...industryQueries)
    
    // Add competitor comparison query if we have competitors
    if (competitors.length > 0) {
      backupQueries.push({
        query: `I've used ${competitors[0]} before. What are better alternatives, and how does ${brandWithContext} compare?${locationSuffix}`,
        dimension: "general"
      })
    }
    
    // Add emerging players query
    backupQueries.push({
      query: `Are there any newer ${specificCategory} ${terms.plural} worth considering over established names?${locationSuffix}`,
      dimension: "reputation"
    })
    
  } else {
    // SOFTWARE QUERIES
    // Dimensions: quality, features, performance, ease_of_use, price, reputation
    
    // Market leader query (reputation)
    backupQueries.push({
      query: `Who are the market leaders in ${specificCategory} right now? I want to know which ${terms.plural} are considered the industry standard and why.`,
      dimension: "reputation"
    })
    
    // Decision-making query (quality)
    backupQueries.push({
      query: `I'm making a final decision on ${specificCategory}. What factors should I consider, and which ${terms.plural} score best on each factor?`,
      dimension: "quality"
    })
    
    // Alternative to competitor query (general)
    if (competitors.length > 0) {
      backupQueries.push({
        query: `We're currently using ${competitors[0]} but considering switching. What are the best ${specificCategory} alternatives${locationSuffix}, and how does ${brandName} compare?`,
        dimension: "general"
      })
    }
    
    // Emerging players query (reputation)
    backupQueries.push({
      query: `Are there any newer or emerging ${specificCategory} ${terms.plural} that are worth considering over the established players? What's gaining traction currently?`,
      dimension: "reputation"
    })
    
    // Budget/value query (price)
    backupQueries.push({
      query: `What are the most cost-effective ${specificCategory} ${terms.plural} that don't compromise on quality? I want good value for money.`,
      dimension: "price"
    })
    
    // Ease of use query (ease_of_use)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are easiest to set up and use? We don't have a large technical team.`,
      dimension: "ease_of_use"
    })
    
    // Integration/features query (features)
    backupQueries.push({
      query: `What ${specificCategory} ${terms.plural} have the best integrations with other software? We need something that connects to our existing stack.`,
      dimension: "features"
    })
    
    // Scaling/performance query (performance)
    backupQueries.push({
      query: `We're a growing company. Which ${specificCategory} ${terms.plural} scale best from small teams to enterprise?`,
      dimension: "performance"
    })
    
    // Reviews/reputation query (reputation)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} have the best reviews and reputation? What do users actually say about them?`,
      dimension: "reputation"
    })
    
    // Reliability/performance query (performance)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} are most reliable and have the best uptime? Performance and stability are critical for us.`,
      dimension: "performance"
    })
    
    // Feature-rich query (features)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} have the most comprehensive feature set? We need an all-in-one solution.`,
      dimension: "features"
    })
    
    // Pricing/affordability query (price)
    backupQueries.push({
      query: `What are the cheapest ${specificCategory} options that are still good? We're a startup on a tight budget.`,
      dimension: "price"
    })
    
    // User experience query (ease_of_use)
    backupQueries.push({
      query: `Which ${specificCategory} ${terms.plural} have the best user experience and interface design? We want something intuitive.`,
      dimension: "ease_of_use"
    })
    
    // Quality/premium query (quality)
    backupQueries.push({
      query: `What's the highest quality ${specificCategory} available? We want the premium option, price is not a concern.`,
      dimension: "quality"
    })
  }

  // ===========================================
  // USER CATEGORY QUERIES
  // Generate queries for each user-provided search category
  // ===========================================
  const categoryQueries: TaggedQuery[] = []
  
  if (searchCategories.length > 0) {
    const currentYear = new Date().getFullYear()
    
    for (const searchCat of searchCategories) {
      const catLower = searchCat.toLowerCase()
      
      // Skip if it's essentially the same as specificCategory
      if (catLower === specificCategory.toLowerCase() || 
          specificCategory.toLowerCase().includes(catLower) ||
          catLower.includes(specificCategory.toLowerCase())) {
        continue
      }
      
      // Generate category-specific queries
      if (productType === "physical") {
        categoryQueries.push({
          query: `What are the best ${searchCat} ${terms.plural}? I'm looking for top recommendations.`,
          dimension: "quality"
        })
        categoryQueries.push({
          query: `Which ${terms.plural} are recommended for ${searchCat}? What should I consider when choosing?`,
          dimension: "reputation"
        })
      } else {
        categoryQueries.push({
          query: `What are the best ${searchCat} ${terms.plural}? What should I consider when evaluating options?`,
          dimension: "quality"
        })
        categoryQueries.push({
          query: `I need a great ${terms.singular} for ${searchCat}. What are the top recommendations?`,
          dimension: "features"
        })
      }
      
      // Brand-specific category query
      categoryQueries.push({
        query: `Is ${brandName} good for ${searchCat}? How does it compare to other ${terms.optionsWord}?`,
        dimension: "general"
      })
    }
  }

  // ===========================================
  // LOCATION-SPECIFIC QUERIES FOR LOCATION-BOUND SERVICES
  // Insurance, banking, healthcare, legal, etc. need geo-specific queries
  // ===========================================
  const locationQueries: TaggedQuery[] = []
  
  if (isLocationBound && locationContext) {
    // Add location-specific queries that are critical for local services
    locationQueries.push({
      query: `What are the best ${specificCategory} providers in ${locationContext}? I need recommendations for ${locationContext}-based options.`,
      dimension: "quality"
    })
    locationQueries.push({
      query: `Which ${specificCategory} companies are recommended in ${locationContext}? What should I look for when choosing?`,
      dimension: "reputation"
    })
    locationQueries.push({
      query: `I live in ${locationContext} and need ${specificCategory}. What are my best options and how do they compare?`,
      dimension: "quality"
    })
    locationQueries.push({
      query: `Top ${specificCategory} ${terms.plural} in ${locationContext} - which ones are most trusted?`,
      dimension: "reputation"
    })
    locationQueries.push({
      query: `${brandName} vs other ${specificCategory} providers in ${locationContext} - how do they compare?`,
      dimension: "general"
    })
    
    console.log(`Generated ${locationQueries.length} location-specific queries for ${locationContext}`)
  }

  // ===========================================
  // QUERY VARIATIONS FOR PAID PLANS
  // Same question phrased differently to test consistency
  // This helps identify if visibility is robust or depends on exact wording
  // ===========================================
  const queryVariations: TaggedQuery[] = []
  
  if (isEnhancedScan) {
    // Generate variation sets - each set tests the same concept with different phrasing
    const variationSets: QueryVariationSet[] = []
    
    // Location suffix for variations
    const varLocationSuffix = locationContext ? ` in ${locationContext}` : ""
    
    if (productType === "physical") {
      // Variation Set 1: "Best products" query (most common user query)
      variationSets.push({
        groupId: "best_products",
        dimension: "quality",
        variations: [
          `What are the best ${specificCategory} ${terms.plural}${varLocationSuffix}?`,
          `Top rated ${specificCategory} ${terms.plural}${varLocationSuffix} to buy`,
          `Which ${specificCategory} ${terms.plural}${varLocationSuffix} are worth buying?`,
        ]
      })
      
      // Variation Set 2: "Recommendations" query
      variationSets.push({
        groupId: "recommendations",
        dimension: "reputation",
        variations: [
          `Can you recommend good ${specificCategory} ${terms.plural}${varLocationSuffix}?`,
          `What ${specificCategory} ${terms.plural} would you suggest?`,
          `I need ${specificCategory} recommendations`,
        ]
      })
      
      // Variation Set 3: Brand-specific query (use context for ambiguous brand names)
      variationSets.push({
        groupId: "brand_specific",
        dimension: "general",
        variations: [
          `What do you think of ${brandWithContext}?`,
          `Is ${brandWithContext} worth it?`,
          `Tell me about ${brandWithContext}`,
        ]
      })
    } else {
      // Software/Service variations
      
      // Variation Set 1: "Best tools" query (most common)
      variationSets.push({
        groupId: "best_tools",
        dimension: "quality",
        variations: [
          `What are the best ${specificCategory} ${terms.plural}?`,
          `Top ${specificCategory} ${terms.plural} available today`,
          `Which ${specificCategory} ${terms.plural} should I use?`,
        ]
      })
      
      // Variation Set 2: "Help me choose" query
      variationSets.push({
        groupId: "help_choose",
        dimension: "general",
        variations: [
          `Help me choose a ${specificCategory}`,
          `What ${specificCategory} do you recommend?`,
          `I need a good ${specificCategory} - suggestions?`,
        ]
      })
      
      // Variation Set 3: Brand-specific query
      variationSets.push({
        groupId: "brand_specific",
        dimension: "general",
        variations: [
          `What do you know about ${brandWithContext}?`,
          `Is ${brandWithContext} a good choice for ${specificCategory}?`,
          `Tell me about ${brandWithContext}`,
        ]
      })
      
      // Variation Set 4: Comparison query (with location if applicable)
  if (competitors.length > 0) {
        variationSets.push({
          groupId: "comparison",
          dimension: "features",
          variations: [
            `Compare ${brandName} to ${competitors[0]}${locationSuffix}`,
            `${brandName} vs ${competitors[0]}${locationSuffix} - which is better?`,
            `Differences between ${brandName} and ${competitors[0]}${locationSuffix}`,
          ]
        })
      }
    }
    
    // Convert variation sets to tagged queries
    for (const set of variationSets) {
      for (let i = 0; i < set.variations.length; i++) {
        queryVariations.push({
          query: set.variations[i],
          dimension: set.dimension,
          variationGroup: `${set.groupId}_v${i + 1}`,
        })
      }
    }
  }

  // ===========================================
  // ENHANCED QUERIES FOR PAID PLANS
  // Additional query types for more comprehensive coverage
  // ===========================================
  const enhancedQueries: TaggedQuery[] = []
  
  if (isEnhancedScan) {
    // Additional diverse queries (not variations)
    if (productType === "physical") {
      enhancedQueries.push(
        { query: `Top ${specificCategory} ${terms.plural} recommended by experts`, dimension: "reputation" },
        { query: `${specificCategory} ${terms.plural} with the best customer reviews`, dimension: "reputation" },
        { query: `${specificCategory} ${terms.plural} that are worth the investment`, dimension: "price" },
        { query: `Sustainable and eco-friendly ${specificCategory} ${terms.plural}`, dimension: "quality" },
        { query: `${specificCategory} ${terms.plural} with the best warranty and support`, dimension: "durability" }
      )
  } else {
      enhancedQueries.push(
        { query: `Top ${specificCategory} ${terms.plural} recommended by industry experts`, dimension: "reputation" },
        { query: `What ${specificCategory} do Fortune 500 companies use?`, dimension: "reputation" },
        { query: `${specificCategory} with the best customer support and documentation`, dimension: "ease_of_use" },
        { query: `Most innovative ${specificCategory} ${terms.plural} right now`, dimension: "features" },
        { query: `${specificCategory} ${terms.plural} with the best ROI`, dimension: "price" },
        { query: `Enterprise-grade ${specificCategory} for large teams`, dimension: "performance" }
      )
    }
    
    // Decision-making queries
    enhancedQueries.push(
      { query: `How do I choose the right ${specificCategory}? What factors matter most?`, dimension: "general" },
      { query: `Common mistakes when choosing ${specificCategory} and how to avoid them`, dimension: "general" }
    )
  }

  // ===========================================
  // BUILD FINAL QUERY LIST
  // Target: queryCount queries (12 free, 25 paid)
  // Prioritize: priority > location > category > variations > contextual > enhanced > backup
  // Ensure coverage of all dimensions
  // NOTE: We do NOT shuffle queries - this ensures consistent, reproducible results
  // ===========================================
  const finalQueries: TaggedQuery[] = [...priorityQueries]
  
  // For location-bound services, add location-specific queries (high priority)
  if (locationQueries.length > 0) {
    const availableLocation = locationQueries.filter(q => 
      !finalQueries.some(existing => existing.query === q.query)
    )
    // Add up to 4 location queries (they're critical for geo-specific services)
    const locationLimit = isEnhancedScan ? 4 : 3
    finalQueries.push(...availableLocation.slice(0, locationLimit))
  }
  
  // Add category-specific queries (high priority for user categories)
  const availableCategory = categoryQueries.filter(q => 
    !finalQueries.some(existing => existing.query === q.query)
  )
  const categoryLimit = isEnhancedScan ? 5 : 4
  finalQueries.push(...availableCategory.slice(0, categoryLimit))
  
  // For enhanced scans, add query variations (these test consistency)
  if (isEnhancedScan && queryVariations.length > 0) {
    const availableVariations = queryVariations.filter(q => 
      !finalQueries.some(existing => existing.query === q.query)
    )
    // Add up to 9 variation queries (3 sets x 3 variations each)
    finalQueries.push(...availableVariations.slice(0, 9))
  }
  
  // Add contextual queries in order (no shuffling for consistency)
  const availableContextual = contextualQueries.filter(q => 
    !finalQueries.some(existing => existing.query === q.query)
  )
  const contextualLimit = isEnhancedScan ? 5 : 5
  finalQueries.push(...availableContextual.slice(0, contextualLimit))
  
  // For enhanced scans, add the enhanced queries
  if (isEnhancedScan && finalQueries.length < queryCount) {
    const availableEnhanced = enhancedQueries.filter(q => 
      !finalQueries.some(existing => existing.query === q.query)
    )
    const enhancedNeeded = queryCount - finalQueries.length
    finalQueries.push(...availableEnhanced.slice(0, enhancedNeeded))
  }
  
  // If we still need more queries, add backup queries
  // Prioritize dimensions we don't have covered yet
  if (finalQueries.length < queryCount) {
    const coveredDimensions = new Set(finalQueries.map(q => q.dimension))
    const allDimensions: QueryDimension[] = productType === "physical"
      ? ["quality", "style", "comfort", "durability", "price", "reputation"]
      : ["quality", "features", "performance", "ease_of_use", "price", "reputation"]
    const missingDimensions = allDimensions.filter(d => !coveredDimensions.has(d))
    
    // First, add queries for missing dimensions (no shuffling)
    const queriesForMissing = backupQueries.filter(q => 
      missingDimensions.includes(q.dimension) && 
      !finalQueries.some(existing => existing.query === q.query)
    )
    
    // Then, add remaining backup queries
    const otherBackup = backupQueries.filter(q => 
      !missingDimensions.includes(q.dimension) &&
      !finalQueries.some(existing => existing.query === q.query)
    )
    
    const needed = queryCount - finalQueries.length
    const backupToAdd = [...queriesForMissing, ...otherBackup].slice(0, needed)
    finalQueries.push(...backupToAdd)
  }
  
  // Validate and clean up queries before returning
  const validatedQueries = finalQueries.slice(0, queryCount).map(tq => ({
    ...tq,
    query: validateAndCleanQuery(tq.query)
  }))
  
  return validatedQueries
}

/**
 * Validate and clean up a query to ensure it's grammatically correct
 */
function validateAndCleanQuery(query: string): string {
  let cleaned = query
  
  // Remove double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  // Fix "the the" and similar duplications
  cleaned = cleaned.replace(/\b(the|a|an|and|or|in|for|to|of|with)\s+\1\b/gi, '$1')
  
  // Fix "companies companies" type duplications
  cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1')
  
  // Fix queries ending with prepositions before punctuation
  cleaned = cleaned.replace(/\s+(in|for|to|of|with|from)\s*([?.!])$/, '$2')
  
  // Fix empty location suffixes (e.g., "in ?" or "in ?")
  cleaned = cleaned.replace(/\s+in\s*[?.!]?$/, '?')
  
  // Ensure query ends with question mark if it's a question
  if (/^(what|which|who|where|when|why|how|is|are|can|do|does|should|would|could)/i.test(cleaned) && 
      !cleaned.endsWith('?') && !cleaned.endsWith('.') && !cleaned.endsWith('!')) {
    cleaned = cleaned + '?'
  }
  
  // Fix "best best" type issues
  cleaned = cleaned.replace(/\bbest\s+best\b/gi, 'best')
  
  // Fix awkward "X X" category repetition
  cleaned = cleaned.replace(/\b(services|products|tools|platforms|brands|companies|providers|agencies)\s+\1\b/gi, '$1')
  
  // Remove trailing "in" with no location
  cleaned = cleaned.replace(/\s+in\s*\?$/, '?')
  cleaned = cleaned.replace(/\s+in\s*$/, '')
  
  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  
  return cleaned
}

/**
 * Generate specific pain point queries based on the product domain
 */
function generateSpecificPainPoints(
  category: string,
  features: string[],
  useCases: string[],
  industry: string | null
): string[] {
  const queries: string[] = []
  const lowerCategory = category.toLowerCase()
  const featureStr = features.slice(0, 2).join(' and ')
  
  // Industry-specific pain points
  if (industry) {
    const industryPainPoints: Record<string, string[]> = {
      "fintech": [
        `We need ${category} software that's compliant with financial regulations. What are the best options for fintech companies?`,
        `Security and compliance are critical for us in finance. Which ${category} tools are most trusted in the financial services industry?`
      ],
      "finance": [
        `We're a financial services firm looking for ${category} software. What do other firms in our industry typically use?`,
        `Regulatory compliance is essential for us. Which ${category} platforms are designed for financial institutions?`
      ],
      "healthcare": [
        `We need HIPAA-compliant ${category} software. What are the best options for healthcare organizations?`,
        `Patient data security is critical. Which ${category} tools are trusted in healthcare?`
      ],
      "ecommerce": [
        `We run an ecommerce business and need ${category} that integrates with our store. What's best for online retailers?`,
        `Order volume and customer management are key for us. Which ${category} tools work best for ecommerce?`
      ],
      "saas": [
        `We're a SaaS company looking for ${category} software. What do other B2B software companies typically use?`,
        `We need ${category} that scales with our subscription business. What's recommended for SaaS companies?`
      ],
      "legal": [
        `We're a law firm needing ${category} software. What's best for legal professionals and maintains confidentiality?`,
        `Client confidentiality and document management are priorities. Which ${category} tools do law firms prefer?`
      ],
      "real estate": [
        `We're in real estate and need ${category} software. What's popular among real estate professionals?`,
        `Property management and client relationships are key for us. Which ${category} tools work best for real estate?`
      ],
    }
    
    for (const [ind, points] of Object.entries(industryPainPoints)) {
      if (industry.toLowerCase().includes(ind) || ind.includes(industry.toLowerCase())) {
        queries.push(...points)
        break
      }
    }
  }

  // Feature-based pain points
  if (features.length > 0) {
    queries.push(
      `We specifically need ${featureStr} capabilities. Which ${category} tools are strongest in these areas?`
    )
  }

  // Use case based pain points
  if (useCases.length > 0) {
    queries.push(
      `Our primary use case is ${useCases[0]}. Which ${category} platforms are best optimized for this?`
    )
  }

  // Category-specific generic pain points
  const categoryPainPoints: Record<string, string[]> = {
    "project management": [
      `Our projects keep going over deadline and budget. Which project management tools have the best tracking and visibility features?`,
      `Team collaboration on projects is chaotic. What's the best project management software for improving team coordination?`
    ],
    "crm": [
      `Our sales team is losing track of leads and deals are falling through the cracks. What CRM would help us get organized?`,
      `We need better visibility into our sales pipeline. Which CRM tools have the best forecasting and reporting?`
    ],
    "analytics": [
      `We're drowning in data but can't get actionable insights. Which analytics platforms are best for business intelligence?`,
      `Creating reports takes too long and they're always outdated. What analytics tools offer real-time dashboards?`
    ],
    "marketing": [
      `Our marketing efforts feel scattered and we can't measure ROI. What marketing tools help with attribution and campaign management?`,
      `We spend too much time on repetitive marketing tasks. Which marketing platforms have the best automation?`
    ],
    "customer support": [
      `Customer inquiries are falling through the cracks. What support tools help manage ticket volume efficiently?`,
      `Our response times are too slow. Which customer support platforms help improve speed and quality?`
    ],
    "compliance": [
      `Staying compliant with regulations is a constant challenge. What compliance tools help automate monitoring and reporting?`,
      `We need to ensure regulatory compliance across our operations. Which platforms are best for compliance management?`
    ],
    "financial compliance": [
      `FCA regulations and financial promotions compliance are critical for us. What tools help manage financial compliance?`,
      `We need to ensure our investment products meet regulatory requirements. Which compliance platforms are designed for finance?`
    ],
  }

  for (const [cat, points] of Object.entries(categoryPainPoints)) {
    if (lowerCategory.includes(cat) || cat.includes(lowerCategory)) {
      queries.push(...points)
      break
    }
  }

  // Generic fallback if no specific matches
  if (queries.length === 0) {
    queries.push(
      `Our current ${category} process is inefficient and error-prone. What are the most reliable tools to improve this?`,
      `We've outgrown our current solution. What ${category} tools are best for scaling companies?`
    )
  }

  return queries
}

/**
 * Extract industry from description
 */
function extractIndustry(description: string): string | null {
  const lowerDesc = description.toLowerCase()
  
  const industries = [
    "fintech", "finance", "financial services", "banking", "investment",
    "healthcare", "health tech", "medical",
    "ecommerce", "e-commerce", "retail",
    "saas", "software", "tech", "b2b",
    "real estate", "property",
    "education", "edtech",
    "legal", "law firm",
    "consulting", "professional services",
    "manufacturing", "industrial",
    "media", "entertainment",
    "travel", "hospitality",
    "nonprofit", "non-profit",
    "government", "public sector",
    "insurance",
    "logistics", "supply chain",
    "construction",
    "automotive",
    "food", "restaurant", "f&b",
    "crypto", "blockchain", "web3"
  ]
  
  for (const industry of industries) {
    if (lowerDesc.includes(industry)) {
      return industry
    }
  }
  
  return null
}

/**
 * Extract key features from description
 */
function extractFeatures(description: string): string[] {
  const features: string[] = []
  const lowerDesc = description.toLowerCase()
  
  const featurePatterns = [
    /with\s+([^,.!?]+(?:,\s*[^,.!?]+)*)/gi,
    /including\s+([^,.!?]+(?:,\s*[^,.!?]+)*)/gi,
    /features?\s+(?:like\s+)?([^,.!?]+)/gi,
    /provides?\s+([^,.!?]+)/gi,
    /offers?\s+([^,.!?]+)/gi,
    /enables?\s+([^,.!?]+)/gi,
    /supports?\s+([^,.!?]+)/gi,
  ]
  
  for (const pattern of featurePatterns) {
    const matches = lowerDesc.matchAll(pattern)
    for (const match of matches) {
      const featureList = match[1].split(/,\s*|and\s+/)
      features.push(...featureList.map(f => f.trim()).filter(f => f.length > 3 && f.length < 60))
    }
  }
  
  return [...new Set(features)].slice(0, 8)
}

/**
 * Extract use case from product description
 */
function extractUseCase(description: string): string | null {
  const lowerDesc = description.toLowerCase()
  
  const forMatch = lowerDesc.match(/for\s+([^,.!?]+)/i)
  if (forMatch) {
    const useCase = forMatch[1].trim()
    return useCase
      .replace(/^(the |a |an )/, '')
      .replace(/\s+(that|which|who)\s+.*$/, '')
  }

  const helpsMatch = lowerDesc.match(/helps?\s+(.+?)\s+(to |with |by )/i)
  if (helpsMatch) {
    return helpsMatch[1].trim()
  }

  const actionMatch = lowerDesc.match(/(manage|organize|track|improve|streamline|simplify|automate|handle|monitor|ensure|maintain)\s+(your\s+)?([^,.!?]+)/i)
  if (actionMatch) {
    return actionMatch[3].trim()
  }

  return null
}

/**
 * Extract target audience from description
 */
function extractAudience(description: string): string | null {
  const lowerDesc = description.toLowerCase()
  
  const audiencePatterns = [
    /for\s+(small teams|startups|enterprises|agencies|freelancers|developers|designers|marketers|remote teams|distributed teams|small businesses|growing companies|large organizations|financial institutions|banks|fintechs|investment firms)/i,
    /helps?\s+(small teams|startups|enterprises|agencies|freelancers|developers|designers|marketers|remote teams|distributed teams|small businesses|growing companies)/i,
    /designed for\s+([^,.!?]+)/i,
    /built for\s+([^,.!?]+)/i,
    /perfect for\s+([^,.!?]+)/i,
    /ideal for\s+([^,.!?]+)/i,
    /trusted by\s+([^,.!?]+)/i,
  ]

  for (const pattern of audiencePatterns) {
    const match = lowerDesc.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Extract the problem the product solves
 */
function extractProblem(description: string): string | null {
  const lowerDesc = description.toLowerCase()
  
  const actionPatterns = [
    /helps?\s+.+?\s+(manage|organize|track|improve|streamline|simplify|collaborate|communicate|automate|monitor|analyze|ensure|maintain)\s+([^,.!?]+)/i,
    /(manage|organize|track|improve|streamline|simplify|automate|handle|monitor|ensure|maintain)\s+(your\s+)?([^,.!?]+)/i,
    /solve[sd]?\s+([^,.!?]+)/i,
    /eliminates?\s+([^,.!?]+)/i,
    /reduces?\s+([^,.!?]+)/i,
  ]

  for (const pattern of actionPatterns) {
    const match = lowerDesc.match(pattern)
    if (match) {
      const verb = match[1]
      const object = match[match.length - 1].trim()
      return `${verb} ${object}`
    }
  }

  return null
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Extract category from description if not provided
 */
export function inferCategory(description: string): string {
  const lowerDesc = description.toLowerCase()
  
  const categoryPatterns: Record<string, string[]> = {
    // ========== INSURANCE & HEALTHCARE (High Priority) ==========
    "health insurance": [
      "health insurance", "medical insurance", "healthcare insurance", "health coverage",
      "krankenkasse", "krankenversicherung", "gesetzliche krankenversicherung", "gkv",
      "statutory health insurance", "public health insurance", "health insurer",
      "medical coverage", "healthcare provider", "health plan", "health fund"
    ],
    "life insurance": ["life insurance", "term life", "whole life insurance", "lebensversicherung"],
    "car insurance": ["car insurance", "auto insurance", "vehicle insurance", "motor insurance", "kfz-versicherung"],
    "home insurance": ["home insurance", "homeowners insurance", "property insurance", "house insurance", "hausratversicherung"],
    "travel insurance": ["travel insurance", "trip insurance", "vacation insurance", "reiseversicherung"],
    "business insurance": ["business insurance", "commercial insurance", "liability insurance", "professional indemnity"],
    "pet insurance": ["pet insurance", "dog insurance", "cat insurance", "animal insurance", "tierversicherung"],
    "insurance": [
      "insurance company", "insurance provider", "insurer", "insurance services",
      "insurance broker", "insurance agency", "versicherung", "assurance"
    ],
    
    // ========== HEALTHCARE & MEDICAL ==========
    "healthcare": [
      "healthcare", "health care", "medical services", "hospital", "clinic",
      "medical provider", "health services", "patient care", "medical practice",
      "gesundheit", "medizin", "arzt", "klinik"
    ],
    "dental": ["dental", "dentist", "dental care", "orthodontist", "dental clinic", "zahnarzt", "zahnklinik"],
    "pharmacy": ["pharmacy", "drugstore", "apotheke", "pharmacist", "prescription"],
    "mental health": ["mental health", "therapy", "counseling", "psychologist", "psychiatrist", "therapist", "psychotherapie"],
    "optometry": ["optometry", "eye care", "optician", "eyeglasses", "contact lenses", "optiker", "augenarzt"],
    "physical therapy": ["physical therapy", "physiotherapy", "rehabilitation", "physio", "krankengymnastik"],
    "chiropractic": ["chiropractic", "chiropractor", "spine care", "back pain"],
    "veterinary": ["veterinary", "vet clinic", "animal hospital", "pet healthcare", "tierarzt", "tierklinik"],
    "senior care": ["senior care", "elderly care", "nursing home", "assisted living", "home care", "altenpflege"],
    "fertility": ["fertility clinic", "ivf", "reproductive health", "fertility treatment"],
    "medical devices": ["medical devices", "medical equipment", "healthcare equipment", "diagnostic equipment"],
    "pharmaceutical": ["pharmaceutical", "pharma company", "drug manufacturer", "biotech", "biopharma"],
    "supplements": ["supplements", "vitamins", "nutraceuticals", "dietary supplements", "health supplements"],
    "telemedicine": ["telemedicine", "telehealth", "virtual healthcare", "online doctor", "remote health"],
    
    // ========== FINANCIAL SERVICES ==========
    "banking": [
      "bank", "banking", "neobank", "banking as a service", "baas",
      "savings account", "checking account", "financial institution", "credit union",
      "sparkasse", "volksbank", "finanzinstitut", "retail banking"
    ],
    "investment banking": ["investment banking", "investment bank", "corporate finance", "m&a advisory"],
    "private banking": ["private banking", "private wealth", "high net worth", "family office"],
    "financial services": [
      "financial services", "finance company", "financial advisor", "wealth management",
      "asset management", "fintech", "finanzdienstleistung"
    ],
    "mortgage": ["mortgage", "home loan", "property loan", "hypothek", "baufinanzierung", "mortgage broker"],
    "loans": ["loan", "lending", "credit", "personal loan", "business loan", "kredit", "darlehen"],
    "credit cards": ["credit card", "credit cards", "rewards card", "cashback card", "kreditkarte"],
    "investment": ["investment", "trading", "portfolio", "assets", "stocks", "bonds", "mutual funds"],
    "cryptocurrency": ["cryptocurrency", "crypto", "bitcoin", "blockchain", "defi", "crypto exchange", "nft"],
    "financial planning": ["financial planning", "retirement planning", "pension", "401k", "ira", "altersvorsorge"],
    "tax services": ["tax services", "tax preparation", "tax advisor", "accountant", "steuerberater"],
    "wealth management": ["wealth management", "investment platform", "portfolio management", "wealthtech"],
    "payments": ["payments", "payment processing", "billing", "subscriptions", "payment gateway"],
    
    // ========== LEGAL SERVICES ==========
    "legal services": [
      "law firm", "lawyer", "attorney", "legal services", "legal advice",
      "rechtsanwalt", "anwalt", "kanzlei", "rechtsberatung", "solicitor", "barrister"
    ],
    "corporate law": ["corporate law", "business attorney", "commercial law", "corporate lawyer"],
    "family law": ["family law", "divorce lawyer", "custody attorney", "familienrecht"],
    "immigration law": ["immigration lawyer", "visa attorney", "immigration services", "einwanderung"],
    "personal injury": ["personal injury lawyer", "accident attorney", "injury claim"],
    "criminal defense": ["criminal defense", "criminal lawyer", "defense attorney"],
    "real estate law": ["real estate attorney", "property lawyer", "conveyancing"],
    "intellectual property": ["ip lawyer", "patent attorney", "trademark lawyer", "intellectual property"],
    "employment law": ["employment lawyer", "labor law", "workplace attorney", "arbeitsrecht"],
    
    // ========== REAL ESTATE ==========
    "real estate": ["real estate", "property", "realty", "immobilien", "real estate agency"],
    "real estate brokerage": ["real estate agent", "realtor", "property agent", "estate agent", "makler"],
    "property management": ["property management", "rental management", "landlord services", "hausverwaltung"],
    "commercial real estate": ["commercial real estate", "office space", "retail space", "industrial property"],
    "residential real estate": ["residential real estate", "homes for sale", "house hunting", "wohnimmobilien"],
    "vacation rentals": ["vacation rental", "short-term rental", "airbnb", "holiday rental", "ferienwohnung"],
    "real estate investment": ["real estate investment", "reit", "property investment", "real estate fund"],
    "home builders": ["home builder", "construction company", "house building", "hausbau", "new construction"],
    "architecture": ["architecture", "architect", "architectural design", "building design", "architekt"],
    "interior design": ["interior design", "interior decorator", "home decorating", "innenarchitektur"],
    
    // ========== AUTOMOTIVE ==========
    "automotive": ["automotive", "automobile", "auto industry"],
    "car dealership": ["car dealership", "auto dealer", "car sales", "vehicle sales", "autohaus", "car dealer"],
    "used cars": ["used cars", "pre-owned vehicles", "second hand cars", "gebrauchtwagen", "2nd hand car"],
    "car buying service": ["car buying", "we buy cars", "webuycars", "sell your car", "sell my car", "car buyer", "instant car sale", "cash for cars"],
    "car marketplace": ["car marketplace", "car market", "auto trader", "autotrader", "car classifieds", "vehicle marketplace"],
    "car rental": ["car rental", "vehicle rental", "rent a car", "autovermietung", "car hire"],
    "auto repair": ["auto repair", "car repair", "mechanic", "auto shop", "werkstatt", "car service"],
    "auto parts": ["auto parts", "car parts", "vehicle parts", "spare parts", "autoteile"],
    "tires": ["tires", "tire shop", "tire dealer", "reifen", "tire service"],
    "car wash": ["car wash", "auto detailing", "vehicle cleaning", "autowasche"],
    "electric vehicles": ["electric vehicle", "ev", "electric car", "tesla", "ev charging", "elektroauto"],
    "motorcycles": ["motorcycle", "motorbike", "bike dealer", "motorrad"],
    "trucks": ["truck", "commercial vehicle", "lorry", "trucking", "lkw"],
    "boats": ["boat", "marine", "yacht", "watercraft", "boat dealer", "boote"],
    "rv": ["rv", "recreational vehicle", "motorhome", "camper", "wohnmobil", "caravan"],
    
    // ========== TRAVEL & HOSPITALITY ==========
    "travel": ["travel", "tourism", "vacation", "holiday", "reisen", "urlaub"],
    "hotels": ["hotel", "resort", "accommodation", "lodging", "hospitality", "hotel chain"],
    "airlines": ["airline", "flights", "aviation", "air travel", "fluggesellschaft"],
    "travel agency": ["travel agency", "travel agent", "tour operator", "reiseburo"],
    "cruises": ["cruise", "cruise line", "ocean cruise", "river cruise", "kreuzfahrt"],
    "tours": ["tour company", "guided tours", "sightseeing", "excursions", "travel tours"],
    "car rental travel": ["rental car", "holiday car hire", "vacation car rental"],
    "business travel": ["business travel", "corporate travel", "travel management"],
    "adventure travel": ["adventure travel", "eco tourism", "adventure tours", "expedition"],
    
    // ========== RESTAURANTS & FOOD SERVICE ==========
    "restaurants": ["restaurant", "dining", "eatery", "food service", "gastronomy", "gastronomie"],
    "fast food": ["fast food", "quick service", "qsr", "fast casual"],
    "fine dining": ["fine dining", "upscale restaurant", "gourmet restaurant", "michelin"],
    "cafes": ["cafe", "coffee shop", "coffeehouse", "kaffeehaus", "bistro"],
    "bars": ["bar", "pub", "nightclub", "lounge", "cocktail bar"],
    "catering": ["catering", "event catering", "food catering", "catering service"],
    "food delivery": ["food delivery", "meal delivery", "restaurant delivery", "lieferservice"],
    "meal kits": ["meal kit", "meal prep", "recipe box", "cooking kit", "kochbox"],
    "bakery": ["bakery", "bakerei", "pastry shop", "patisserie", "bread"],
    "food & beverage": ["food", "beverage", "drinks", "snacks", "coffee", "tea"],
    
    // ========== RETAIL & ECOMMERCE ==========
    "retail": ["retail", "retailer", "store", "shop", "einzelhandel"],
    "ecommerce": ["ecommerce", "e-commerce", "online store", "shopping cart", "sell online", "online shop"],
    "department stores": ["department store", "retail chain", "big box", "kaufhaus"],
    "grocery": ["grocery", "supermarket", "grocery store", "lebensmittel", "food retail"],
    "convenience stores": ["convenience store", "corner shop", "minimart"],
    "luxury retail": ["luxury retail", "luxury goods", "high-end retail", "designer brands"],
    "discount retail": ["discount store", "dollar store", "bargain retail", "outlet"],
    "wholesale": ["wholesale", "distributor", "b2b sales", "grosshandel"],
    "marketplace": ["marketplace", "online marketplace", "multi-vendor", "marktplatz"],
    
    // ========== EDUCATION ==========
    "education": ["education", "school", "learning", "teaching", "bildung"],
    "higher education": ["university", "college", "higher education", "universitat", "hochschule"],
    "k-12 education": ["k-12", "elementary school", "high school", "primary school", "secondary school"],
    "online education": ["online learning", "e-learning", "online courses", "mooc", "edtech"],
    "tutoring": ["tutoring", "tutor", "private lessons", "nachhilfe", "test prep"],
    "language learning": ["language learning", "language school", "esl", "language courses", "sprachschule"],
    "professional training": ["professional training", "corporate training", "skills training", "certification"],
    "coding bootcamp": ["coding bootcamp", "programming course", "tech education", "developer training"],
    "music education": ["music school", "music lessons", "instrument lessons", "musikschule"],
    "driving school": ["driving school", "driving lessons", "fahrschule", "driver education"],
    "childcare": ["childcare", "daycare", "preschool", "kindergarten", "kinderbetreuung"],
    
    // ========== FITNESS & WELLNESS ==========
    "fitness": ["fitness", "gym", "health club", "workout", "fitnessstudio"],
    "yoga": ["yoga studio", "yoga classes", "yoga instructor", "yogaschule"],
    "personal training": ["personal trainer", "personal training", "fitness coach", "pt"],
    "pilates": ["pilates", "pilates studio", "pilates instructor"],
    "crossfit": ["crossfit", "crossfit gym", "crossfit box", "functional fitness"],
    "martial arts": ["martial arts", "karate", "judo", "boxing gym", "mma", "kampfsport"],
    "swimming": ["swimming pool", "swim school", "aquatic center", "schwimmbad"],
    "spa": ["spa", "day spa", "wellness spa", "massage", "wellness center"],
    "meditation": ["meditation", "mindfulness", "meditation app", "wellness app"],
    "nutrition": ["nutritionist", "dietitian", "nutrition coaching", "ernahrungsberatung"],
    
    // ========== BEAUTY & PERSONAL CARE ==========
    "beauty": ["beauty", "skincare", "makeup", "cosmetics", "haircare", "personal care"],
    "hair salon": ["hair salon", "hairdresser", "barber", "friseur", "hair stylist"],
    "nail salon": ["nail salon", "manicure", "pedicure", "nail art", "nagelstudio"],
    "cosmetic surgery": ["cosmetic surgery", "plastic surgery", "aesthetic medicine", "beauty clinic"],
    "skincare": ["skincare brand", "skin care", "dermatology", "hautpflege"],
    "perfume": ["perfume", "fragrance", "cologne", "parfum"],
    "cosmetics": ["cosmetics brand", "makeup brand", "beauty products", "kosmetik"],
    
    // ========== FASHION & APPAREL ==========
    "fashion": ["fashion brand", "clothing brand", "apparel brand", "fashion label", "mode"],
    "luxury fashion": ["luxury fashion", "designer fashion", "haute couture", "premium fashion"],
    "streetwear": ["streetwear", "urban fashion", "street style"],
    "activewear": ["activewear", "athletic wear", "athleisure", "workout clothes", "yoga wear", "yoga clothing", "fitness wear", "sports clothing", "gym wear", "exercise clothing"],
    "yoga apparel": ["yoga apparel", "yoga pants", "yoga leggings", "yoga brand"],
    "sportswear": ["sportswear", "sports apparel", "athletic apparel", "performance wear"],
    "shoes": ["shoes", "footwear", "sneakers", "running shoes", "athletic shoes", "boots", "sandals"],
    "luxury shoes": ["designer shoes", "luxury footwear", "high-end shoes"],
    "jewelry": ["jewelry", "jewellery", "fine jewelry", "jeweler", "schmuck", "juwelier"],
    "watches": ["watches", "watch brand", "luxury watches", "smartwatch", "uhren"],
    "eyewear": ["eyewear", "sunglasses", "glasses brand", "optical", "brillen"],
    "handbags": ["handbags", "bags", "purses", "leather goods", "taschen"],
    "lingerie": ["lingerie", "underwear", "intimate apparel", "undergarments"],
    "children's clothing": ["children's clothing", "kids wear", "baby clothes", "kindermode"],
    "maternity": ["maternity wear", "maternity clothing", "pregnancy fashion"],
    "plus size": ["plus size fashion", "curvy fashion", "extended sizes"],
    "sustainable fashion": ["sustainable fashion", "eco fashion", "ethical clothing", "nachhaltige mode"],
    
    // ========== HOME & GARDEN ==========
    "home & furniture": ["furniture", "home decor", "mattress", "bedding", "home goods", "mobel"],
    "kitchen": ["kitchen", "cookware", "kitchen appliances", "kitchenware", "kuche"],
    "bathroom": ["bathroom", "bath fixtures", "bathroom accessories", "bad"],
    "lighting": ["lighting", "lamps", "light fixtures", "beleuchtung"],
    "flooring": ["flooring", "carpet", "hardwood floors", "tile", "laminate", "bodenbelag"],
    "gardening": ["gardening", "garden supplies", "plants", "nursery", "garten"],
    "landscaping": ["landscaping", "lawn care", "garden design", "outdoor living", "landschaftsbau"],
    "pool & spa": ["pool", "swimming pool", "hot tub", "spa", "pool service"],
    "home security": ["home security", "alarm system", "smart home security", "security camera"],
    "smart home": ["smart home", "home automation", "iot home", "connected home"],
    "cleaning services": ["cleaning service", "house cleaning", "maid service", "janitorial", "reinigung"],
    "pest control": ["pest control", "exterminator", "pest management", "schadlingsbekampfung"],
    "moving services": ["moving company", "movers", "relocation", "umzug", "moving service"],
    "storage": ["storage", "self storage", "storage unit", "lagerung"],
    
    // ========== HOME IMPROVEMENT & CONSTRUCTION ==========
    "home improvement": ["home improvement", "renovation", "remodeling", "home repair"],
    "construction": ["construction", "contractor", "building", "general contractor", "bau"],
    "roofing": ["roofing", "roof repair", "roofer", "dachdecker"],
    "plumbing": ["plumbing", "plumber", "pipe repair", "klempner", "sanitär"],
    "electrical": ["electrical", "electrician", "electrical contractor", "elektriker"],
    "hvac": ["hvac", "heating", "air conditioning", "ventilation", "klimaanlage", "heizung"],
    "windows": ["windows", "window replacement", "window installation", "fenster"],
    "doors": ["doors", "door installation", "garage doors", "turen"],
    "painting": ["painting", "house painting", "painter", "maler"],
    "carpentry": ["carpentry", "carpenter", "woodwork", "tischler", "schreiner"],
    
    // ========== PROFESSIONAL SERVICES ==========
    "consulting": ["consulting", "consultant", "advisory", "beratung", "management consulting"],
    "it consulting": ["it consulting", "technology consulting", "it services", "it-beratung"],
    "marketing agency": ["marketing agency", "digital agency", "ad agency", "werbeagentur"],
    "pr agency": ["pr agency", "public relations", "communications agency"],
    "web development": ["web development", "web design", "website development", "webentwicklung"],
    "app development": ["app development", "mobile development", "app agency"],
    "staffing": ["staffing agency", "recruitment agency", "headhunter", "personalvermittlung"],
    "translation": ["translation services", "interpreter", "localization", "ubersetzung"],
    "printing": ["printing", "print shop", "commercial printing", "druckerei"],
    "photography": ["photography", "photographer", "photo studio", "fotograf"],
    "videography": ["videography", "video production", "film production", "videoproduktion"],
    "event planning": ["event planning", "event management", "wedding planner", "eventplanung"],
    "security services": ["security services", "security company", "guards", "sicherheitsdienst"],
    "courier": ["courier", "delivery service", "express delivery", "kurier"],
    
    // ========== TELECOMMUNICATIONS & UTILITIES ==========
    "telecommunications": [
      "telecom", "telecommunications", "mobile carrier", "phone carrier",
      "internet provider", "isp", "telekommunikation", "mobilfunk"
    ],
    "mobile carrier": ["mobile carrier", "cell phone provider", "wireless carrier", "mobilfunkanbieter"],
    "internet provider": ["internet provider", "isp", "broadband", "fiber internet", "internetanbieter"],
    "cable tv": ["cable tv", "television provider", "satellite tv", "streaming tv"],
    "utilities": ["utility", "electricity", "gas provider", "energy provider", "power company", "stadtwerke"],
    "solar energy": ["solar", "solar panels", "solar energy", "renewable energy", "solarenergie"],
    "water utility": ["water utility", "water company", "water service", "wasserversorger"],
    
    // ========== ENTERTAINMENT & MEDIA ==========
    "entertainment": ["entertainment", "media", "entertainment company"],
    "streaming": ["streaming", "video streaming", "streaming service", "ott"],
    "music streaming": ["music streaming", "music service", "audio streaming"],
    "podcasts": ["podcast", "podcasting", "podcast network", "audio content"],
    "gaming": ["gaming", "video games", "esports", "game developer", "spieleentwickler"],
    "movies": ["movies", "film", "cinema", "movie theater", "kino"],
    "live events": ["live events", "concerts", "festivals", "live entertainment"],
    "ticketing": ["ticketing", "event tickets", "ticket sales", "kartenverkauf"],
    "sports": ["sports", "sports team", "athletics", "professional sports"],
    "sports equipment": ["sports equipment", "sporting goods", "athletic equipment", "sportgerate"],
    "music": ["music", "music production", "record label", "music artist", "musik"],
    "publishing": ["publishing", "book publisher", "magazine", "news", "verlag"],
    "news media": ["news", "journalism", "news outlet", "nachrichten"],
    
    // ========== TECHNOLOGY & SOFTWARE ==========
    "technology": ["technology", "tech company", "tech startup", "technologie"],
    "saas": ["saas", "software as a service", "cloud software", "subscription software"],
    "enterprise software": ["enterprise software", "business software", "enterprise solution"],
    "cybersecurity": ["cybersecurity", "cyber security", "information security", "it security"],
    "cloud computing": ["cloud computing", "cloud services", "aws", "azure", "cloud infrastructure"],
    "ai": ["artificial intelligence", "ai company", "machine learning", "ai platform", "ki"],
    "data analytics": ["data analytics", "big data", "data science", "business analytics"],
    "iot": ["iot", "internet of things", "connected devices", "smart devices"],
    "robotics": ["robotics", "automation", "robots", "industrial automation"],
    "vr ar": ["virtual reality", "vr", "augmented reality", "ar", "mixed reality"],
    "3d printing": ["3d printing", "additive manufacturing", "3d printer"],
    
    // ========== SOFTWARE CATEGORIES (Specific) ==========
    "project management": ["project management", "task management", "project tracking", "work management", "team tasks", "task tracking"],
    "CRM": ["crm", "customer relationship", "sales management", "customer management", "sales pipeline", "lead management"],
    "email marketing": ["email marketing", "newsletter", "email automation", "email campaigns"],
    "analytics": ["analytics", "data analytics", "business intelligence", "reporting", "dashboards", "metrics"],
    "design": ["design tool", "graphic design", "ui design", "ux design", "prototyping", "mockups", "design software"],
    "sales": ["sales tool", "sales automation", "lead generation", "outbound sales", "sales engagement"],
    "HR": ["hr software", "human resources", "recruiting", "hiring", "employee management", "payroll"],
    "accounting": ["accounting", "finance software", "bookkeeping", "invoicing", "expenses"],
    "marketing": ["marketing tool", "marketing automation", "growth tool", "campaign management"],
    "collaboration": ["collaboration", "team collaboration", "workspace", "teamwork"],
    "communication": ["communication", "team messaging", "chat", "video conferencing", "meetings"],
    "note-taking": ["notes", "note-taking", "documentation", "knowledge base", "wiki"],
    "scheduling": ["scheduling", "calendar", "appointment", "booking"],
    "file storage": ["file storage", "cloud storage", "file sharing", "document management"],
    "customer support": ["customer support", "help desk", "ticketing", "customer service"],
    "compliance": ["compliance", "regulatory", "regtech", "governance"],
    "financial compliance": ["financial compliance", "fca", "fintech compliance", "investment compliance", "financial promotions"],
    "stock music": ["stock music", "music licensing", "royalty-free music", "production music", "music library"],
    "stock video": ["stock video", "stock footage", "video clips", "b-roll"],
    "stock photos": ["stock photos", "stock images", "image library", "photo library"],
    "video editing": ["video editing", "video editor", "video production", "video software"],
    "audio editing": ["audio editing", "audio software", "podcast editing", "sound editing"],
    "website builder": ["website builder", "web builder", "landing page", "no-code website"],
    "social media": ["social media", "social management", "social scheduling", "social posting"],
    "SEO": ["seo", "search engine", "keyword research", "search optimization"],
    "automation": ["automation", "workflow automation", "no-code automation", "zapier alternative"],
    "database": ["database", "airtable", "spreadsheet database", "no-code database"],
    "forms": ["forms", "form builder", "surveys", "questionnaires"],
    "investment software": ["investment software", "trading platform", "portfolio management", "robo advisor"],
    
    // ========== SPORTS & RECREATION ==========
    "golf": ["golf", "golf course", "golf equipment", "golf club"],
    "tennis": ["tennis", "tennis club", "tennis equipment", "tennis court"],
    "skiing": ["skiing", "ski resort", "ski equipment", "snowboarding", "winter sports"],
    "cycling": ["cycling", "bike shop", "bicycle", "cycling gear", "fahrrad"],
    "running": ["running", "running gear", "marathon", "running shoes brand"],
    "fishing": ["fishing", "fishing gear", "fishing charter", "angeln"],
    "hunting": ["hunting", "hunting gear", "outdoor hunting", "jagd"],
    "surfing": ["surfing", "surf shop", "surfboard", "surf gear"],
    "outdoor gear": ["outdoor", "camping", "hiking", "outdoor gear", "adventure"],
    
    // ========== PET INDUSTRY ==========
    "pet products": ["pet", "dog products", "cat products", "pet food", "pet supplies", "tierbedarf"],
    "pet food": ["pet food", "dog food", "cat food", "tierfutter"],
    "pet grooming": ["pet grooming", "dog grooming", "pet salon", "hundesalon"],
    "pet sitting": ["pet sitting", "dog walking", "pet care", "tierbetreuung"],
    "pet stores": ["pet store", "pet shop", "tierhandlung"],
    
    // ========== NON-PROFIT & GOVERNMENT ==========
    "nonprofit": ["nonprofit", "non-profit", "charity", "foundation", "ngo", "gemeinnutzig"],
    "government": ["government", "public sector", "municipal", "offentlich", "regierung"],
    "association": ["association", "trade association", "professional association", "verband"],
    "religious": ["church", "religious organization", "faith-based", "kirche", "mosque", "synagogue"],
    
    // ========== MISCELLANEOUS ==========
    "dating": ["dating app", "dating service", "matchmaking", "online dating"],
    "subscription box": ["subscription box", "monthly box", "subscription service"],
    "cannabis": ["cannabis", "dispensary", "cbd", "marijuana", "hemp"],
    "wine": ["wine", "winery", "vineyard", "wine club", "weingut"],
    "beer": ["brewery", "craft beer", "beer brand", "brauerei"],
    "spirits": ["spirits", "distillery", "liquor", "whiskey", "vodka"],
    "coworking": ["coworking", "shared office", "flexible workspace", "coworking space"],
    "franchise": ["franchise", "franchising", "franchise opportunity"],
    "accessories": ["accessories", "bags", "handbags"],
    "electronics": ["electronics", "gadgets", "phone", "laptop", "headphones", "speakers", "tech hardware"],
  }

  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(pattern => lowerDesc.includes(pattern))) {
      return category
    }
  }

  // Check for software/tool patterns
  const toolMatch = lowerDesc.match(/(\w+(?:\s+\w+)?)\s+(?:tool|software|platform|app|solution|service)/i)
  if (toolMatch) {
    return toolMatch[1].trim()
  }

  // Check for physical product patterns
  const productMatch = lowerDesc.match(/(\w+(?:\s+\w+)?)\s+(?:brand|products|company|clothing|apparel|wear)/i)
  if (productMatch) {
    return productMatch[1].trim()
  }

  // Try to extract a meaningful category from description
  // Look for common product type indicators
  if (lowerDesc.includes("clothing") || lowerDesc.includes("apparel") || lowerDesc.includes("wear")) {
    return "clothing"
  }
  if (lowerDesc.includes("yoga")) {
    return "yoga & fitness"
  }
  
  // Check for insurance-related terms (important for companies like Santam)
  if (lowerDesc.includes("insurance") || lowerDesc.includes("insurer") || lowerDesc.includes("insure")) {
    return "insurance"
  }
  
  // Check for financial/banking terms
  if (lowerDesc.includes("bank") || lowerDesc.includes("financial") || lowerDesc.includes("finance")) {
    return "financial services"
  }
  
  // Check for healthcare terms
  if (lowerDesc.includes("health") || lowerDesc.includes("medical") || lowerDesc.includes("hospital") || lowerDesc.includes("clinic")) {
    return "healthcare"
  }
  
  // Check for real estate terms
  if (lowerDesc.includes("real estate") || lowerDesc.includes("property") || lowerDesc.includes("realty")) {
    return "real estate"
  }
  
  // Check for restaurant/food terms
  if (lowerDesc.includes("restaurant") || lowerDesc.includes("food") || lowerDesc.includes("dining") || lowerDesc.includes("cafe")) {
    return "restaurants"
  }
  
  // Check for travel terms
  if (lowerDesc.includes("travel") || lowerDesc.includes("hotel") || lowerDesc.includes("tourism") || lowerDesc.includes("vacation")) {
    return "travel"
  }
  
  // Check for education terms
  if (lowerDesc.includes("education") || lowerDesc.includes("school") || lowerDesc.includes("university") || lowerDesc.includes("learning")) {
    return "education"
  }
  
  // Check for automotive terms
  if (lowerDesc.includes("car") || lowerDesc.includes("auto") || lowerDesc.includes("vehicle") || lowerDesc.includes("motor")) {
    return "automotive"
  }
  
  // If we can extract a noun phrase, use that instead of "software"
  const nounMatch = lowerDesc.match(/(?:a|an|the)\s+(\w+(?:\s+\w+)?)\s+(?:company|provider|brand|business|firm|service)/i)
  if (nounMatch) {
    return nounMatch[1].trim()
  }

  // Last resort: return "business" instead of "software" - it's more generic
  return "business services"
}
