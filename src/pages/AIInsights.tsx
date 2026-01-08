import React, { useState } from 'react'
import { Brain, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const AIInsights: React.FC = () => {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const isSalesRepViewOnly = String(currentUserRole || '').toLowerCase() === 'sales_representative'

  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('week')

  React.useEffect(() => {
    let active = true
    const loadRole = async () => {
      try {
        if (!user?.id) return
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (!active) return
        setCurrentUserRole((data as any)?.role ? String((data as any).role) : null)
      } catch {
        if (!active) return
        setCurrentUserRole(null)
      }
    }
    loadRole()
    return () => { active = false }
  }, [user?.id])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">AI Insights</h1>
        </div>
        <div className="flex space-x-2">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            disabled={isSalesRepViewOnly}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Production Efficiency</h3>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">87%</p>
            <p className="text-sm font-medium text-green-600">+5%</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">vs last month</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Demand Forecast Accuracy</h3>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">94%</p>
            <p className="text-sm font-medium text-green-600">+2%</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">prediction accuracy</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Cost Optimization</h3>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">$1,250</p>
            <p className="text-sm font-medium text-red-600">-$180</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">monthly savings</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Quality Score</h3>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">9.2/10</p>
            <p className="text-sm font-medium text-green-600">+0.3</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">customer rating</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Smart Recommendations</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-lg bg-green-50">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">Production Efficiency Opportunity</h3>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                    High Impact
                  </span>
                </div>
                <p className="text-gray-600 mb-3">Your chocolate chip cookie production could be 15% more efficient by adjusting batch timing.</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Confidence: 92%</span>
                  </div>
                  {!isSalesRepViewOnly && (
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      View Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-lg bg-orange-50">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">Inventory Shortage Prediction</h3>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Medium Impact
                  </span>
                </div>
                <p className="text-gray-600 mb-3">Based on current trends, you may run out of vanilla extract in 5 days.</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Confidence: 87%</span>
                  </div>
                  {!isSalesRepViewOnly && (
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      View Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIInsights
