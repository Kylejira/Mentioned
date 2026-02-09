'use client';

import { useState, useEffect } from 'react';

// 5 diverse example products with different scores
const EXAMPLES = [
  {
    product: 'Cal.com',
    category: 'scheduling software',
    score: 87,
    status: 'Excellent',
    statusColor: 'emerald',
    mentionRate: '85%',
    topRate: '70%',
    avgPosition: '#1.4',
    chatgpt: { mentioned: true, score: 90 },
    claude: { mentioned: true, score: 84 },
    query: 'What\'s the best scheduling tool for teams?',
  },
  {
    product: 'Notion',
    category: 'productivity tool',
    score: 94,
    status: 'Excellent',
    statusColor: 'emerald',
    mentionRate: '95%',
    topRate: '88%',
    avgPosition: '#1.1',
    chatgpt: { mentioned: true, score: 96 },
    claude: { mentioned: true, score: 92 },
    query: 'Best note-taking app for students?',
  },
  {
    product: 'Acme CRM',
    category: 'CRM software',
    score: 32,
    status: 'Low',
    statusColor: 'red',
    mentionRate: '25%',
    topRate: '5%',
    avgPosition: '#6.2',
    chatgpt: { mentioned: false, score: 28 },
    claude: { mentioned: true, score: 36 },
    query: 'What CRM should I use for my startup?',
  },
  {
    product: 'Stripe',
    category: 'payment gateway',
    score: 98,
    status: 'Excellent',
    statusColor: 'emerald',
    mentionRate: '100%',
    topRate: '95%',
    avgPosition: '#1.0',
    chatgpt: { mentioned: true, score: 98 },
    claude: { mentioned: true, score: 98 },
    query: 'Best payment processor for SaaS?',
  },
  {
    product: 'QuickInvoice',
    category: 'invoicing app',
    score: 12,
    status: 'Not Visible',
    statusColor: 'red',
    mentionRate: '10%',
    topRate: '0%',
    avgPosition: 'N/A',
    chatgpt: { mentioned: false, score: 8 },
    claude: { mentioned: false, score: 16 },
    query: 'What\'s the best invoicing app for freelancers?',
  },
];

// Hook for counting animation
function useCountUp(target: number, duration: number = 1000, trigger: boolean = true) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!trigger) {
      setCount(0);
      return;
    }
    
    let startTime: number;
    let animationFrame: number;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * target));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, trigger]);
  
  return count;
}

// Hook for typing animation
function useTypewriter(text: string, speed: number = 30, trigger: boolean = true) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  useEffect(() => {
    if (!trigger) {
      setDisplayText('');
      setIsTyping(false);
      return;
    }
    
    setIsTyping(true);
    let i = 0;
    setDisplayText('');
    
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed, trigger]);
  
  return { displayText, isTyping };
}

// Feature bubbles that float on the right side
const FEATURE_BUBBLES = [
  {
    text: "Get actionable tips",
    icon: "💡",
    delay: 0,
    position: "top-[15%] -right-4 lg:right-[-140px]",
  },
  {
    text: "Track over time",
    icon: "📈",
    delay: 0.5,
    position: "top-[45%] -right-2 lg:right-[-120px]",
  },
  {
    text: "Generate content",
    icon: "✨",
    delay: 1,
    position: "top-[75%] -right-4 lg:right-[-130px]",
  },
];

export function RotatingDashboardPreview() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  
  const example = EXAMPLES[currentIndex];
  
  // Animated values
  const animatedScore = useCountUp(example.score, 1200, showContent && animationPhase >= 2);
  const animatedChatGPT = useCountUp(example.chatgpt.score, 800, showContent && animationPhase >= 4);
  const animatedClaude = useCountUp(example.claude.score, 800, showContent && animationPhase >= 4);
  const { displayText: typedQuery, isTyping } = useTypewriter(example.query, 25, showContent);
  
  // Staggered animation phases
  useEffect(() => {
    if (!showContent) {
      setAnimationPhase(0);
      return;
    }
    
    const timers = [
      setTimeout(() => setAnimationPhase(1), 100),   // Query appears
      setTimeout(() => setAnimationPhase(2), 600),   // Score starts counting
      setTimeout(() => setAnimationPhase(3), 1000),  // Stats appear
      setTimeout(() => setAnimationPhase(4), 1400),  // Platform bars animate
      setTimeout(() => setAnimationPhase(5), 1800),  // Platform cards appear
    ];
    
    return () => timers.forEach(clearTimeout);
  }, [showContent]);
  
  // Rotate through examples
  useEffect(() => {
    // Initial show
    const initialTimer = setTimeout(() => setShowContent(true), 300);
    
    const rotationTimer = setInterval(() => {
      setShowContent(false);
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % EXAMPLES.length);
        setIsTransitioning(false);
        
        setTimeout(() => setShowContent(true), 100);
      }, 400);
    }, 6000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(rotationTimer);
    };
  }, []);
  
  // Color helpers
  const getStatusColors = (status: string) => {
    switch (status) {
      case 'Excellent':
        return { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
      case 'Good':
        return { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', bar: 'bg-blue-500' };
      case 'Moderate':
        return { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', bar: 'bg-amber-500' };
      default:
        return { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', bar: 'bg-red-500' };
    }
  };
  
  const colors = getStatusColors(example.status);
  const scoreColor = example.score >= 70 ? 'text-emerald-500' : example.score >= 40 ? 'text-amber-500' : 'text-red-500';
  
  const handleDotClick = (idx: number) => {
    setShowContent(false);
    setIsTransitioning(true);
    
    setTimeout(() => {
      setCurrentIndex(idx);
      setIsTransitioning(false);
      setTimeout(() => setShowContent(true), 100);
    }, 300);
  };
  
  return (
    <div className="relative px-2 sm:px-0">
      {/* Animated glow effect */}
      <div className="absolute inset-0 -z-10">
        <div className={`
          absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
          w-[400px] h-[400px] rounded-full blur-3xl
          transition-all duration-700 ease-out
          ${showContent ? 'opacity-30 scale-100' : 'opacity-0 scale-75'}
          ${example.score >= 70 ? 'bg-emerald-400' : example.score >= 40 ? 'bg-amber-400' : 'bg-red-400'}
        `} />
      </div>
      
      {/* Floating animation wrapper */}
      <div className="lg:animate-float">
        {/* Query bubble with typing effect */}
        <div className={`
          mb-3 transition-all duration-500 ease-out
          ${showContent && animationPhase >= 1 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 -translate-y-4'
          }
        `}>
          <div className="inline-flex items-center gap-2 bg-white text-gray-700 text-xs sm:text-sm px-4 py-2.5 rounded-full shadow-lg border border-gray-200 max-w-[340px] sm:max-w-none animate-pulse-border">
            <svg className="w-4 h-4 flex-shrink-0 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span className="truncate">
              &quot;{typedQuery}&quot;
              {isTyping && (
                <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse" />
              )}
            </span>
          </div>
        </div>
        
        {/* Main dashboard card */}
        <div className={`
          bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-gray-200/50 
          border border-gray-100 overflow-hidden
          max-w-[360px] sm:max-w-[420px] mx-auto lg:mx-0
          transition-all duration-500 ease-out
          ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
        `}>
          {/* Card header */}
          <div className="p-4 sm:p-5 pb-0">
            {/* Product name and status */}
            <div className={`
              flex items-start justify-between mb-4
              transition-all duration-500 delay-100
              ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
            `}>
              <div>
                <h3 className="text-gray-900 font-semibold text-base sm:text-lg">{example.product}</h3>
                <p className="text-gray-400 text-xs">AI visibility dashboard</p>
              </div>
              <div className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-300
                ${colors.bg}
                ${showContent && animationPhase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
              `}>
                <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
                <span className={`text-xs font-medium ${colors.text}`}>{example.status}</span>
              </div>
            </div>
            
            {/* Score section */}
            <div className={`
              flex items-end gap-4 mb-4
              transition-all duration-500 delay-200
              ${showContent && animationPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            `}>
              <div>
                <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide mb-1">Visibility Score</p>
                <div className="flex items-baseline gap-1">
                  <span className={`
                    text-4xl sm:text-5xl font-bold tabular-nums transition-colors duration-500
                    ${scoreColor}
                  `}>
                    {animatedScore}
                  </span>
                  <span className="text-gray-300 text-lg sm:text-xl font-medium">/100</span>
                </div>
              </div>
              
              {/* Mini stats - staggered appearance */}
              <div className="flex-1 grid grid-cols-2 gap-2 text-center">
                <div className={`
                  bg-gray-50 rounded-lg p-2 transition-all duration-300
                  ${showContent && animationPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                `}
                style={{ transitionDelay: '0ms' }}
                >
                  <p className="text-gray-400 text-[9px] sm:text-[10px] uppercase">Mention Rate</p>
                  <p className="text-gray-900 text-sm sm:text-base font-semibold">{example.mentionRate}</p>
                </div>
                <div className={`
                  bg-gray-50 rounded-lg p-2 transition-all duration-300
                  ${showContent && animationPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                `}
                style={{ transitionDelay: '100ms' }}
                >
                  <p className="text-gray-400 text-[9px] sm:text-[10px] uppercase">Avg Position</p>
                  <p className="text-gray-900 text-sm sm:text-base font-semibold">{example.avgPosition}</p>
                </div>
              </div>
            </div>
            
            {/* Progress bar with animation */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${colors.bar}`}
                style={{ 
                  width: showContent && animationPhase >= 2 ? `${example.score}%` : '0%',
                  transitionDelay: '200ms'
                }}
              />
            </div>
          </div>
          
          {/* Platform breakdown */}
          <div className={`
            px-4 sm:px-5 pb-4 sm:pb-5
            transition-all duration-500
            ${showContent && animationPhase >= 4 ? 'opacity-100' : 'opacity-0'}
          `}>
            <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide mb-2">Score by AI model</p>
            <div className="grid grid-cols-2 gap-3">
              {/* ChatGPT */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold bg-gray-500">
                  G
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 text-xs sm:text-sm font-medium">ChatGPT</span>
                    <span className="text-gray-900 text-xs sm:text-sm font-semibold tabular-nums">
                      {animatedChatGPT}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: showContent && animationPhase >= 4 ? `${example.chatgpt.score}%` : '0%',
                        transitionDelay: '100ms'
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Claude */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold bg-[#D97706]">
                  C
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 text-xs sm:text-sm font-medium">Claude</span>
                    <span className="text-gray-900 text-xs sm:text-sm font-semibold tabular-nums">
                      {animatedClaude}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: showContent && animationPhase >= 4 ? `${example.claude.score}%` : '0%',
                        transitionDelay: '200ms'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
        
        {/* Floating feature bubbles - hidden on mobile, visible on larger screens */}
        <div className="hidden lg:block">
          {FEATURE_BUBBLES.map((bubble, index) => (
            <div
              key={index}
              className={`
                absolute ${bubble.position}
                transition-all duration-500
                ${showContent && animationPhase >= 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
              `}
              style={{
                animation: `floatBubble 4s ease-in-out infinite`,
                animationDelay: `${bubble.delay}s`,
                transitionDelay: `${800 + index * 200}ms`,
              }}
            >
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-100 shadow-lg shadow-gray-200/50 rounded-full px-3 py-2 text-xs font-medium text-gray-700 hover:shadow-xl hover:scale-105 hover:bg-white transition-all duration-300 cursor-default whitespace-nowrap">
                <span className="text-sm">{bubble.icon}</span>
                <span>{bubble.text}</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Rotation indicator dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {EXAMPLES.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => handleDotClick(idx)}
              className={`
                h-1.5 rounded-full transition-all duration-300 
                ${idx === currentIndex 
                  ? 'bg-blue-600 w-6' 
                  : 'bg-gray-200 w-1.5 hover:w-3 hover:bg-blue-400'
                }
              `}
              aria-label={`View ${EXAMPLES[idx].product} example`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
