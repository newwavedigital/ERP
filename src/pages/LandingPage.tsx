import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowRight, CheckCircle, BarChart3, Package, ShoppingCart, Zap, TrendingUp, Factory, Truck, Layers, Settings, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Custom hook for scroll animations
const useScrollAnimation = () => {
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const observeElement = useCallback((element: HTMLElement, id: string) => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const elementId = entry.target.getAttribute('data-animate-id')
            if (elementId) {
              setVisibleElements(prev => {
                const newSet = new Set(prev)
                if (entry.isIntersecting) {
                  newSet.add(elementId)
                } else {
                  // Remove elements when they go out of view so animations can replay
                  newSet.delete(elementId)
                }
                return newSet
              })
            }
          })
        },
        { 
          threshold: 0.2,
          rootMargin: '-100px 0px -100px 0px'
        }
      )
    }

    element.setAttribute('data-animate-id', id)
    observerRef.current.observe(element)

    return () => {
      if (observerRef.current && element) {
        observerRef.current.unobserve(element)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return { visibleElements, observeElement }
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, initializing } = useAuth()
  const [currentSlide, setCurrentSlide] = useState(0)
  const { visibleElements, observeElement } = useScrollAnimation()

  // Refs for scroll animation elements
  const heroRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const processRef = useRef<HTMLDivElement>(null)
  const testimonialsRef = useRef<HTMLDivElement>(null)
  const benefitsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (initializing) return
    if (!user) return
    let target = '/admin/dashboard'
    try {
      const last = localStorage.getItem('erp_last_admin_path')
      if (last && last.startsWith('/admin')) target = last
    } catch {}
    if (window.location.hash === '#/' || window.location.hash === '' || window.location.hash.startsWith('#/landing')) {
      navigate(target, { replace: true })
    }
  }, [initializing, user, navigate])

  // Set up scroll observers for all sections
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = []

    if (heroRef.current) cleanupFunctions.push(observeElement(heroRef.current, 'hero'))
    if (statsRef.current) cleanupFunctions.push(observeElement(statsRef.current, 'stats'))
    if (featuresRef.current) cleanupFunctions.push(observeElement(featuresRef.current, 'features'))
    if (processRef.current) cleanupFunctions.push(observeElement(processRef.current, 'process'))
    if (testimonialsRef.current) cleanupFunctions.push(observeElement(testimonialsRef.current, 'testimonials'))
    if (benefitsRef.current) cleanupFunctions.push(observeElement(benefitsRef.current, 'benefits'))
    if (ctaRef.current) cleanupFunctions.push(observeElement(ctaRef.current, 'cta'))

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [observeElement])

  

  const carouselSlides = [
    {
      title: "Smart Production Planning",
      description: "Optimize manufacturing schedules with AI-powered demand forecasting and resource allocation.",
      image: "production",
      stats: { value: "95%", label: "Production Efficiency" }
    },
    {
      title: "Intelligent Inventory Control",
      description: "Real-time stock monitoring with automated reorder points and supplier integration.",
      image: "inventory",
      stats: { value: "40%", label: "Cost Reduction" }
    },
    {
      title: "Seamless Purchase Management",
      description: "Streamlined procurement workflows from requisition to delivery with full traceability.",
      image: "purchasing",
      stats: { value: "60%", label: "Faster Processing" }
    },
    {
      title: "Raw Material Optimization",
      description: "Track material consumption, minimize waste, and ensure quality compliance.",
      image: "materials",
      stats: { value: "25%", label: "Waste Reduction" }
    }
  ]

  

  

  const features = [
    {
      icon: Factory,
      title: "Production Management",
      description: "Complete production lifecycle management from planning to quality control with real-time monitoring.",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Layers,
      title: "Material Resource Planning",
      description: "Optimize raw material allocation, track consumption, and maintain optimal stock levels.",
      color: "from-green-500 to-green-600"
    },
    {
      icon: ShoppingCart,
      title: "Smart Procurement",
      description: "Automated purchase workflows with supplier evaluation, cost analysis, and delivery tracking.",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: Package,
      title: "Inventory Allocation",
      description: "Intelligent stock allocation across multiple locations with demand-driven distribution.",
      color: "from-orange-500 to-orange-600"
    },
    {
      icon: BarChart3,
      title: "Production Analytics",
      description: "Advanced analytics for production efficiency, cost optimization, and performance insights.",
      color: "from-red-500 to-red-600"
    },
    {
      icon: Truck,
      title: "Supply Chain Integration",
      description: "End-to-end supply chain visibility with vendor management and logistics coordination.",
      color: "from-teal-500 to-teal-600"
    }
  ]

  const stats = [
    { number: "500+", label: "Companies Trust Us" },
    { number: "99.9%", label: "Uptime Guarantee" },
    { number: "24/7", label: "Expert Support" },
    { number: "50%", label: "Cost Reduction" }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Add CSS animations */}
      <style>{`
        @keyframes slideInFromLeft {
          0% { transform: translateX(-100px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInFromRight {
          0% { transform: translateX(100px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInFromBottom {
          0% { transform: translateY(100px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInFromTop {
          0% { transform: translateY(-100px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeInScale {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeInRotate {
          0% { transform: rotate(-10deg) scale(0.8); opacity: 0; }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideInStagger {
          0% { transform: translateY(50px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        
        .animate-slide-in-left { animation: slideInFromLeft 0.8s ease-out forwards; }
        .animate-slide-in-right { animation: slideInFromRight 0.8s ease-out forwards; }
        .animate-slide-in-bottom { animation: slideInFromBottom 0.8s ease-out forwards; }
        .animate-slide-in-top { animation: slideInFromTop 0.8s ease-out forwards; }
        .animate-fade-in-scale { animation: fadeInScale 0.8s ease-out forwards; }
        .animate-fade-in-rotate { animation: fadeInRotate 0.8s ease-out forwards; }
        .animate-bounce-in { animation: bounceIn 0.8s ease-out forwards; }
        .animate-slide-in-stagger { animation: slideInStagger 0.6s ease-out forwards; }
        
        .animate-delay-100 { animation-delay: 0.1s; }
        .animate-delay-200 { animation-delay: 0.2s; }
        .animate-delay-300 { animation-delay: 0.3s; }
        .animate-delay-400 { animation-delay: 0.4s; }
        .animate-delay-500 { animation-delay: 0.5s; }
        .animate-delay-600 { animation-delay: 0.6s; }
        .animate-delay-700 { animation-delay: 0.7s; }
        .animate-delay-800 { animation-delay: 0.8s; }
        
        .scroll-animate {
          opacity: 0;
          transform: translateY(50px);
          transition: all 0.6s ease-out;
        }
        
        .scroll-animate.visible {
          opacity: 1;
          transform: translateY(0);
        }
        
        /* Reset animations when not visible */
        .animate-slide-in-left:not(.visible) { 
          opacity: 0; 
          transform: translateX(-100px); 
          animation: none; 
        }
        .animate-slide-in-right:not(.visible) { 
          opacity: 0; 
          transform: translateX(100px); 
          animation: none; 
        }
        .animate-slide-in-bottom:not(.visible) { 
          opacity: 0; 
          transform: translateY(100px); 
          animation: none; 
        }
        .animate-slide-in-top:not(.visible) { 
          opacity: 0; 
          transform: translateY(-100px); 
          animation: none; 
        }
        .animate-fade-in-scale:not(.visible) { 
          opacity: 0; 
          transform: scale(0.8); 
          animation: none; 
        }
        .animate-fade-in-rotate:not(.visible) { 
          opacity: 0; 
          transform: rotate(-10deg) scale(0.8); 
          animation: none; 
        }
        .animate-bounce-in:not(.visible) { 
          opacity: 0; 
          transform: scale(0.3); 
          animation: none; 
        }
        .animate-slide-in-stagger:not(.visible) { 
          opacity: 0; 
          transform: translateY(50px); 
          animation: none; 
        }
      `}</style>

      {/* Navigation */}
      <nav className="bg-white border-b border-neutral-soft px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-medium rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-neutral-dark">ERP System</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="text-neutral-medium hover:text-primary-medium transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/login')}
              className="bg-primary-medium hover:bg-primary-dark text-white px-6 py-2 rounded-full transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        ref={heroRef}
        className={`bg-gradient-to-br from-neutral-light via-white to-primary-light/10 py-20 overflow-hidden scroll-animate ${visibleElements.has('hero') ? 'visible' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`animate-slide-in-left ${visibleElements.has('hero') ? 'visible' : ''}`}>
              <h1 className={`text-5xl font-bold text-neutral-dark mb-6 leading-tight animate-slide-in-bottom animate-delay-200 ${visibleElements.has('hero') ? 'visible' : ''}`}>
                Transform Your Business with 
                <span className={`text-primary-medium bg-gradient-to-r from-primary-medium to-primary-dark bg-clip-text text-transparent animate-fade-in-scale animate-delay-400 ${visibleElements.has('hero') ? 'visible' : ''}`}> Smart ERP</span>
              </h1>
              <p className={`text-xl text-neutral-medium mb-8 leading-relaxed animate-slide-in-bottom animate-delay-300 ${visibleElements.has('hero') ? 'visible' : ''}`}>
                Streamline production planning, optimize material allocation, and automate procurement 
                workflows with our comprehensive Enterprise Resource Planning solution.
              </p>
              <div className={`flex flex-col sm:flex-row gap-4 mb-8 animate-slide-in-bottom animate-delay-500 ${visibleElements.has('hero') ? 'visible' : ''}`}>
                <button
                  onClick={() => navigate('')}
                  className="bg-gradient-to-r from-primary-medium to-primary-dark hover:from-primary-dark hover:to-primary-medium text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button className="border-2 border-neutral-soft hover:border-primary-medium text-neutral-dark px-8 py-4 rounded-full font-semibold transition-all hover:bg-primary-medium/5 flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  Watch Demo
                </button>
              </div>
              <div className={`flex items-center gap-6 text-sm text-neutral-medium animate-slide-in-bottom animate-delay-600 ${visibleElements.has('hero') ? 'visible' : ''}`}>
                <div className="flex items-center gap-2 animate-pulse">
                  <CheckCircle className="w-4 h-4 text-accent-success" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent-success" />
                  14-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent-success" />
                  Cancel anytime
                </div>
              </div>
            </div>
            
            {/* Enhanced Carousel Dashboard Preview */}
            <div className={`relative animate-slide-in-right animate-delay-400 ${visibleElements.has('hero') ? 'visible' : ''}`}>
              <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* Carousel Container */}
                <div className="relative h-[400px]">
                  {carouselSlides.map((slide, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-all duration-700 transform ${
                        index === currentSlide ? 'translate-x-0 opacity-100' : 
                        index < currentSlide ? '-translate-x-full opacity-0' : 'translate-x-full opacity-0'
                      }`}
                    >
                      <div className="p-8 h-full flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-primary-medium to-primary-dark rounded-xl flex items-center justify-center">
                              {slide.image === 'production' && <Factory className="w-6 h-6 text-white" />}
                              {slide.image === 'inventory' && <Package className="w-6 h-6 text-white" />}
                              {slide.image === 'purchasing' && <ShoppingCart className="w-6 h-6 text-white" />}
                              {slide.image === 'materials' && <Layers className="w-6 h-6 text-white" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs bg-accent-success/10 text-accent-success px-3 py-1 rounded-full">
                              <div className="w-2 h-2 bg-accent-success rounded-full animate-pulse"></div>
                              Active
                            </div>
                          </div>
                          <h3 className="text-2xl font-bold text-neutral-dark mb-3">{slide.title}</h3>
                          <p className="text-neutral-medium mb-6">{slide.description}</p>
                        </div>
                        
                        {/* Stats Display */}
                        <div className="bg-gradient-to-r from-primary-light/10 to-primary-medium/10 rounded-2xl p-6">
                          <div className="text-center">
                            <div className="text-4xl font-bold text-primary-dark mb-2">{slide.stats.value}</div>
                            <div className="text-sm text-neutral-medium">{slide.stats.label}</div>
                            <div className="w-full bg-neutral-soft rounded-full h-2 mt-3">
                              <div className="bg-gradient-to-r from-primary-medium to-primary-dark h-2 rounded-full animate-pulse" style={{width: slide.stats.value}}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Carousel Controls */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                  {carouselSlides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        index === currentSlide ? 'bg-primary-medium scale-125' : 'bg-neutral-soft hover:bg-primary-light'
                      }`}
                    />
                  ))}
                </div>
                
                {/* Navigation Arrows */}
                <button
                  onClick={() => setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length)}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
                >
                  <ChevronLeft className="w-5 h-5 text-neutral-dark" />
                </button>
                <button
                  onClick={() => setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
                >
                  <ChevronRight className="w-5 h-5 text-neutral-dark" />
                </button>
              </div>
              
              {/* Floating Animation Elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary-light/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent-success/20 rounded-full blur-2xl animate-bounce" style={{animationDuration: '3s'}}></div>
              <div className="absolute top-1/2 -right-8 w-16 h-16 bg-accent-warning/20 rounded-full blur-lg animate-ping" style={{animationDuration: '2s'}}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section 
        ref={statsRef}
        className={`py-16 bg-neutral-dark scroll-animate ${visibleElements.has('stats') ? 'visible' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center animate-bounce-in ${visibleElements.has('stats') ? 'visible' : ''}`}
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="text-4xl font-bold text-white mb-2">{stat.number}</div>
                <div className="text-neutral-soft">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      

      

      {/* Features Section */}
      <section 
        ref={featuresRef}
        className={`py-20 bg-gradient-to-b from-white to-neutral-light/30 scroll-animate ${visibleElements.has('features') ? 'visible' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className={`text-center mb-16 animate-slide-in-top ${visibleElements.has('features') ? 'visible' : ''}`}>
            <h2 className="text-4xl font-bold text-neutral-dark mb-4">
              Complete ERP Solutions for Modern Manufacturing
            </h2>
            <p className="text-xl text-neutral-medium max-w-3xl mx-auto">
              From raw material procurement to finished goods delivery, manage your entire 
              production ecosystem with intelligent automation and real-time insights.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`bg-white p-8 rounded-2xl hover:shadow-2xl transition-all duration-500 group transform hover:-translate-y-2 border border-neutral-soft/50 hover:border-transparent animate-slide-in-stagger ${visibleElements.has('features') ? 'visible' : ''}`}
                style={{animationDelay: `${index * 0.15}s`}}
              >
                <div className={`w-14 h-14 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-neutral-dark mb-4 group-hover:text-primary-dark transition-colors">{feature.title}</h3>
                <p className="text-neutral-medium leading-relaxed">{feature.description}</p>
                <div className="mt-6 flex items-center text-primary-medium group-hover:text-primary-dark transition-colors">
                  <span className="text-sm font-medium">Learn More</span>
                  <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Production Process Section */}
      <section 
        ref={processRef}
        className={`py-20 bg-gradient-to-r from-primary-dark to-primary-medium text-white overflow-hidden scroll-animate ${visibleElements.has('process') ? 'visible' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className={`text-center mb-16 animate-slide-in-top ${visibleElements.has('process') ? 'visible' : ''}`}>
            <h2 className="text-4xl font-bold mb-4">Streamlined Production Workflow</h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              From planning to delivery, track every step of your manufacturing process
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: Settings, title: "Plan", desc: "Production scheduling & resource allocation" },
              { icon: Factory, title: "Produce", desc: "Real-time manufacturing monitoring" },
              { icon: Package, title: "Package", desc: "Quality control & packaging management" },
              { icon: Truck, title: "Deliver", desc: "Logistics coordination & tracking" }
            ].map((step, index) => (
              <div 
                key={index} 
                className={`text-center group animate-fade-in-scale ${visibleElements.has('process') ? 'visible' : ''}`}
                style={{animationDelay: `${index * 0.2}s`}}
              >
                <div className="relative">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                    <step.icon className="w-10 h-10 text-white" />
                  </div>
                  {index < 3 && (
                    <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-white/30">
                      <div className="h-full bg-white/60 animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-white/80 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section 
        ref={testimonialsRef}
        className={`py-20 bg-white scroll-animate ${visibleElements.has('testimonials') ? 'visible' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className={`text-center mb-16 animate-slide-in-top ${visibleElements.has('testimonials') ? 'visible' : ''}`}>
            <h2 className="text-4xl font-bold text-neutral-dark mb-4">
              Trusted by Industry Leaders
            </h2>
            <p className="text-xl text-neutral-medium max-w-3xl mx-auto">
              See how manufacturing companies are transforming their operations with our ERP solution
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "Our production efficiency increased by 40% within the first quarter. The real-time inventory tracking has eliminated stockouts completely.",
                author: "Maria Santos",
                title: "Production Manager",
                company: "ABC Manufacturing Corp",
                metric: "40% efficiency boost"
              },
              {
                quote: "The automated procurement system reduced our purchasing costs by 25% and improved supplier relationships significantly.",
                author: "John Chen",
                title: "Supply Chain Director", 
                company: "Global Foods Inc",
                metric: "25% cost reduction"
              },
              {
                quote: "Material waste dropped by 30% thanks to the intelligent allocation system. ROI was achieved in just 6 months.",
                author: "Sarah Rodriguez",
                title: "Operations Director",
                company: "Premium Products Ltd",
                metric: "30% waste reduction"
              }
            ].map((testimonial, index) => (
              <div 
                key={index} 
                className={`bg-gradient-to-br from-neutral-light/50 to-white p-8 rounded-2xl border border-neutral-soft/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-slide-in-stagger ${visibleElements.has('testimonials') ? 'visible' : ''}`}
                style={{animationDelay: `${index * 0.2}s`}}
              >
                <div className="mb-6">
                  <div className="text-6xl text-primary-medium/20 font-serif">"</div>
                  <p className="text-neutral-dark leading-relaxed -mt-4">{testimonial.quote}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-primary-medium to-primary-dark rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{testimonial.author.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-dark">{testimonial.author}</div>
                    <div className="text-sm text-neutral-medium">{testimonial.title}</div>
                    <div className="text-sm text-primary-medium font-medium">{testimonial.company}</div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 bg-accent-success/10 text-accent-success px-3 py-1 rounded-full text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    {testimonial.metric}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section 
        ref={benefitsRef}
        className={`py-20 bg-gradient-to-br from-primary-dark to-primary-medium text-white scroll-animate ${visibleElements.has('benefits') ? 'visible' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`animate-slide-in-left ${visibleElements.has('benefits') ? 'visible' : ''}`}>
              <h2 className="text-4xl font-bold mb-6">
                Why Manufacturing Leaders Choose Our ERP
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Rapid Implementation</h3>
                    <p className="text-white/80">Industry-specific templates and pre-configured workflows get your manufacturing operations online in weeks, not months.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Factory className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Manufacturing-First Design</h3>
                    <p className="text-white/80">Built specifically for production environments with shop floor integration, quality control, and compliance tracking.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Real-Time Intelligence</h3>
                    <p className="text-white/80">Live production dashboards, predictive analytics, and automated alerts keep you ahead of issues before they impact delivery.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <h3 className="text-2xl font-bold mb-6">Ready to Transform Your Operations?</h3>
              <p className="text-white/80 mb-6">
                Join 500+ manufacturing companies already using our ERP system to optimize production, reduce costs, and accelerate growth.
              </p>
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-white/90">
                  <CheckCircle className="w-5 h-5 text-accent-success" />
                  <span>Free 14-day trial with full features</span>
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <CheckCircle className="w-5 h-5 text-accent-success" />
                  <span>Dedicated implementation specialist</span>
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <CheckCircle className="w-5 h-5 text-accent-success" />
                  <span>24/7 manufacturing support</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-white text-primary-dark px-8 py-4 rounded-full font-semibold hover:bg-neutral-light transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-sm text-white/60 text-center mt-4">
                No setup fees • No long-term contracts • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section 
        ref={ctaRef}
        className={`py-20 bg-gradient-to-r from-neutral-light to-white scroll-animate ${visibleElements.has('cta') ? 'visible' : ''}`}
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className={`animate-slide-in-bottom ${visibleElements.has('cta') ? 'visible' : ''}`}>
            <h2 className="text-4xl font-bold text-neutral-dark mb-6">
              Ready to Transform Your Manufacturing Operations?
            </h2>
            <p className="text-xl text-neutral-medium mb-8 max-w-2xl mx-auto">
              Join thousands of manufacturers who have streamlined their operations with our comprehensive ERP solution.
            </p>
            <div className={`flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-scale animate-delay-300 ${visibleElements.has('cta') ? 'visible' : ''}`}>
              <button
                onClick={() => navigate('/home')}
                className="bg-gradient-to-r from-primary-medium to-primary-dark hover:from-primary-dark hover:to-primary-medium text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="border-2 border-primary-medium hover:bg-primary-medium hover:text-white text-primary-medium px-8 py-4 rounded-full font-semibold transition-all"
              >
                Schedule Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-dark text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-primary-medium rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold">ERP System</span>
              </div>
              <p className="text-neutral-soft text-sm">
                Empowering businesses with intelligent ERP solutions for the digital age.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-neutral-soft">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-neutral-soft">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-neutral-soft">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-medium/20 mt-8 pt-8 text-center text-sm text-neutral-soft">
            <p>&copy; 2025 ERP System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
